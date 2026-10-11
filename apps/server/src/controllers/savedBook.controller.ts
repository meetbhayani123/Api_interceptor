import type { Request, Response } from 'express';
import { Match } from '../models/Match.js';
import { SavedBook } from '../models/SavedBook.js';
import { recordBook } from '../services/SavedBookService.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Escape user input before it reaches a regex, or `.*` would scan everything. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readPaging(req: Request) {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const requested = Number.parseInt(String(req.query.limit ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * POST /api/match/:id/save-book
 *
 * Records the match's current full-history book. The figures come from the
 * server, not the request body: the client must not be able to write an
 * arbitrary number into what is meant to be a trustworthy record.
 */
export async function saveBook(req: Request, res: Response) {
  try {
    const matchId = req.params.id;

    const saved = await recordBook(matchId, { trigger: 'manual' });
    if (!saved) return res.status(404).json({ error: 'Match not found' });

    res.status(201).json({ message: 'Book saved', savedBook: saved });
  } catch (error: any) {
    console.error('[SavedBookController] Save error:', error);
    res.status(500).json({ error: 'Failed to save book' });
  }
}

/**
 * GET /api/saved-books?search=&page=&limit=
 *
 * One row per match that has at least one save, most recently saved first.
 */
export async function listSavedBookMatches(req: Request, res: Response) {
  try {
    const { page, limit, skip } = readPaging(req);
    const search = String(req.query.search ?? '').trim();

    const match = search
      ? { matchName: { $regex: escapeRegex(search), $options: 'i' } }
      : {};

    const [result] = await SavedBook.aggregate([
      { $match: match },
      { $sort: { savedAt: -1 } },
      {
        $group: {
          _id: '$matchId',
          matchName: { $first: '$matchName' },
          teamA: { $first: '$teamA' },
          teamB: { $first: '$teamB' },
          saveCount: { $sum: 1 },
          lastSavedAt: { $first: '$savedAt' },
          lastTeamA_PL: { $first: '$teamA_PL' },
          lastTeamB_PL: { $first: '$teamB_PL' },
        },
      },
      { $sort: { lastSavedAt: -1 } },
      {
        // One round trip for both the page and the count it belongs to.
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            { $project: { _id: 0, matchId: '$_id', matchName: 1, teamA: 1, teamB: 1, saveCount: 1, lastSavedAt: 1, lastTeamA_PL: 1, lastTeamB_PL: 1 } },
          ],
          meta: [{ $count: 'total' }],
        },
      },
    ]).exec();

    const total = result?.meta?.[0]?.total ?? 0;

    res.json({
      items: result?.items ?? [],
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error: any) {
    console.error('[SavedBookController] List error:', error);
    res.status(500).json({ error: 'Failed to list saved books' });
  }
}

/**
 * GET /api/saved-books/:matchId?page=&limit=
 *
 * Every saved book for one match, newest first.
 */
export async function listSavedBooksForMatch(req: Request, res: Response) {
  try {
    const { matchId } = req.params;
    const { page, limit, skip } = readPaging(req);

    const [items, total] = await Promise.all([
      SavedBook.find({ matchId }).sort({ savedAt: -1 }).skip(skip).limit(limit).lean(),
      SavedBook.countDocuments({ matchId }),
    ]);

    if (total === 0) {
      return res.status(404).json({ error: 'No saved books for this match' });
    }

    res.json({
      items,
      // Denormalised on the rows, so this still reads correctly after the
      // match itself has been deleted.
      matchName: items[0]?.matchName ?? '',
      teamA: items[0]?.teamA ?? '',
      teamB: items[0]?.teamB ?? '',
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error: any) {
    console.error('[SavedBookController] Detail error:', error);
    res.status(500).json({ error: 'Failed to load saved books' });
  }
}
