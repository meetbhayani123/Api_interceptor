import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

/** Escape user input before it reaches a regex, or `.*` would scan everything. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readPaging(req: Request, fallback = DEFAULT_PAGE_SIZE) {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const requested = Number.parseInt(String(req.query.limit ?? fallback), 10) || fallback;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, limit, skip: (page - 1) * limit };
}

const isValidId = (id: string) => mongoose.Types.ObjectId.isValid(id);

/**
 * Optional capture-time window from ?from=&to=.
 *
 * Both bounds are inclusive and independent — a `from` alone means "everything
 * after", a `to` alone "everything up to". Unparseable values are ignored
 * rather than rejected, so a stray query string degrades to the full range
 * instead of erroring the page.
 */
function readTimeRange(req: Request): { capturedAt?: { $gte?: Date; $lte?: Date } } {
  const parse = (raw: unknown): Date | undefined => {
    const value = String(raw ?? '').trim();
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const from = parse(req.query.from);
  const to = parse(req.query.to);
  if (!from && !to) return {};

  const capturedAt: { $gte?: Date; $lte?: Date } = {};
  if (from) capturedAt.$gte = from;
  if (to) capturedAt.$lte = to;
  return { capturedAt };
}

/** GET /api/archives?search=&page=&limit= — archived matches, newest first */
export async function listArchives(req: Request, res: Response) {
  try {
    const { page, limit, skip } = readPaging(req, 20);
    const search = String(req.query.search ?? '').trim();

    const filter = search ? { name: { $regex: escapeRegex(search), $options: 'i' } } : {};

    const [items, total] = await Promise.all([
      ArchivedMatch.find(filter).sort({ archivedAt: -1 }).skip(skip).limit(limit).lean(),
      ArchivedMatch.countDocuments(filter),
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error: any) {
    console.error('[ArchiveController] List error:', error);
    res.status(500).json({ error: 'Failed to list archives' });
  }
}

/** GET /api/archives/:id — one archived match */
export async function getArchive(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(404).json({ error: 'Archive not found' });

    const archive = await ArchivedMatch.findById(id).lean();
    if (!archive) return res.status(404).json({ error: 'Archive not found' });

    res.json(archive);
  } catch (error: any) {
    console.error('[ArchiveController] Detail error:', error);
    res.status(500).json({ error: 'Failed to load archive' });
  }
}

/** GET /api/archives/:id/frames?page=&limit= — captured frames, oldest first */
export async function listArchiveFrames(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(404).json({ error: 'Archive not found' });

    const { page, limit, skip } = readPaging(req);
    const range = readTimeRange(req);
    const filter = { archiveId: id, ...range };

    const [items, total] = await Promise.all([
      ArchivedFrame.find(filter)
        .sort({ capturedAt: 1, sequenceId: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ArchivedFrame.countDocuments(filter),
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      // Echo back what was actually applied, so the UI can show the window it
      // is displaying rather than what the user typed.
      filtered: Boolean(range.capturedAt),
      from: range.capturedAt?.$gte ?? null,
      to: range.capturedAt?.$lte ?? null,
    });
  } catch (error: any) {
    console.error('[ArchiveController] Frames error:', error);
    res.status(500).json({ error: 'Failed to load frames' });
  }
}

/**
 * GET /api/archives/:id/download — every frame as a downloadable JSON file.
 *
 * Streamed from a cursor rather than built in memory: an archive can hold tens
 * of thousands of frames, and serialising all of them at once would spike the
 * heap on a small instance.
 */
export async function downloadArchive(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(404).json({ error: 'Archive not found' });

    const archive = await ArchivedMatch.findById(id).lean();
    if (!archive) return res.status(404).json({ error: 'Archive not found' });

    // Same window as the table, so the export matches what was on screen.
    const range = readTimeRange(req);

    const safeName = (archive.name || 'match')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 80);
    const stamp = new Date(archive.archivedAt).toISOString().slice(0, 10);
    const rangeSuffix = range.capturedAt ? '-filtered' : '';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-${stamp}${rangeSuffix}.json"`);

    // Header first, then frames one at a time.
    res.write('{\n');
    res.write(`  "match": ${JSON.stringify({
      name: archive.name,
      teamA: archive.teamA,
      teamB: archive.teamB,
      eventId: archive.eventId,
      marketId: archive.marketId,
      startTime: archive.startTime,
      finalBook: archive.finalBook,
      bookHighLow: archive.bookHighLow,
      frameCount: archive.frameCount,
      firstFrameAt: archive.firstFrameAt,
      lastFrameAt: archive.lastFrameAt,
      archivedAt: archive.archivedAt,
      // Present only when the export covers part of the capture.
      filterFrom: range.capturedAt?.$gte ?? undefined,
      filterTo: range.capturedAt?.$lte ?? undefined,
    }, null, 2).split('\n').join('\n  ')},\n`);
    res.write('  "frames": [\n');

    const cursor = ArchivedFrame.find({ archiveId: id, ...range })
      .sort({ capturedAt: 1, sequenceId: 1 })
      .select({ _id: 0, sequenceId: 1, capturedAt: 1, teamA: 1, teamB: 1 })
      .lean()
      .cursor();

    let first = true;
    for await (const frame of cursor) {
      const row = {
        sequenceId: frame.sequenceId,
        capturedAt: frame.capturedAt,
        teamA_back_odd: frame.teamA?.odds?.[0] ?? null,
        teamA_lay_odd: frame.teamA?.odds?.[1] ?? null,
        teamA_back_price: frame.teamA?.pricing?.[0] ?? null,
        teamA_lay_price: frame.teamA?.pricing?.[1] ?? null,
        teamB_back_odd: frame.teamB?.odds?.[0] ?? null,
        teamB_lay_odd: frame.teamB?.odds?.[1] ?? null,
        teamB_back_price: frame.teamB?.pricing?.[0] ?? null,
        teamB_lay_price: frame.teamB?.pricing?.[1] ?? null,
      };
      res.write(`${first ? '    ' : ',\n    '}${JSON.stringify(row)}`);
      first = false;
    }

    res.write('\n  ]\n}\n');
    res.end();
  } catch (error: any) {
    console.error('[ArchiveController] Download error:', error);
    // Headers may already be out; only send JSON if nothing was written.
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to build download' });
    } else {
      res.end();
    }
  }
}
