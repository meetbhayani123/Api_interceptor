import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';
import { archiveMatch } from './ArchiveService.js';

/** Needs a MongoDB; skipped cleanly without one. */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/archive_test';
let available = false;

before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
    available = true;
  } catch {
    available = false;
  }
});

after(async () => {
  if (!available) return;
  await Promise.all([
    Match.deleteMany({}), OddsSnapshot.deleteMany({}),
    ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({}),
  ]);
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([
    Match.deleteMany({}), OddsSnapshot.deleteMany({}),
    ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({}),
  ]);
});

async function seed(frameCount: number) {
  const match = await Match.create({
    name: 'Pakistan v Sri Lanka', teamA: 'Pakistan', teamB: 'Sri Lanka',
    eventId: '35461234', marketId: '1.263614060',
    startTime: new Date('2026-10-11T13:00:00Z'), status: 'completed', oddsHistory: [],
    finalBook: { teamA_PL: -30_900_000, teamB_PL: 229_900_000 },
    bookHighLow: { teamA_high: 1, teamA_low: -2, teamB_high: 3, teamB_low: -4 },
    totalSnapshotCount: frameCount,
  });
  const id = (match._id as any).toString();

  if (frameCount > 0) {
    await OddsSnapshot.insertMany(
      Array.from({ length: frameCount }, (_, i) => ({
        matchId: id, sequenceId: i + 1, signature: `sig${i}`,
        capturedAt: new Date(Date.UTC(2026, 9, 11, 13, 0, i)),
        teamA: { odds: [1.88 + i / 1000, 1.9 + i / 1000], pricing: [24500 + i, 18900 + i] },
        teamB: { odds: [2.12 - i / 1000, 2.16 - i / 1000], pricing: [31200 - i, 27750 - i] },
      }))
    );
  }
  return id;
}

describe('archiveMatch', () => {
  it('keeps the match name and summary', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const id = await seed(5);

    const result = await archiveMatch(id);
    assert.ok(result);
    assert.equal(result!.name, 'Pakistan v Sri Lanka');
    assert.equal(result!.frameCount, 5);

    const archive = await ArchivedMatch.findById(result!.archiveId).lean();
    assert.equal(archive?.name, 'Pakistan v Sri Lanka');
    assert.equal(archive?.teamA, 'Pakistan');
    assert.equal(archive?.marketId, '1.263614060');
    assert.deepEqual(archive?.finalBook, { teamA_PL: -30_900_000, teamB_PL: 229_900_000 });
    assert.equal(archive?.frameCount, 5);
  });

  it('copies every frame with all eight values intact', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const id = await seed(5);
    const result = await archiveMatch(id);

    const frames = await ArchivedFrame.find({ archiveId: result!.archiveId })
      .sort({ capturedAt: 1 }).lean();

    assert.equal(frames.length, 5);
    const first = frames[0];
    assert.deepEqual(first.teamA.odds, [1.88, 1.9]);
    assert.deepEqual(first.teamA.pricing, [24500, 18900]);
    assert.deepEqual(first.teamB.odds, [2.12, 2.16]);
    assert.deepEqual(first.teamB.pricing, [31200, 27750]);
    assert.equal(first.sequenceId, 1);
  });

  it('survives the originals being deleted, which is the whole point', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const id = await seed(20);
    const result = await archiveMatch(id);

    await OddsSnapshot.deleteMany({ matchId: id });
    await Match.findByIdAndDelete(id);

    assert.equal(await OddsSnapshot.countDocuments({ matchId: id }), 0);
    assert.equal(await Match.countDocuments({ _id: id }), 0);
    assert.equal(await ArchivedFrame.countDocuments({ archiveId: result!.archiveId }), 20);

    const archive = await ArchivedMatch.findById(result!.archiveId).lean();
    assert.equal(archive?.name, 'Pakistan v Sri Lanka');
  });

  it('archived frames carry no TTL index of their own', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // Archives DO expire — ArchiveRetentionService purges them after the
    // retention window — but that must stay keyed on `archivedAt`, when the
    // record was made. A TTL index here could only key on `capturedAt`, when
    // the odds were originally recorded, so archiving an old match would see
    // its frames vanish immediately. This guards against someone adding one.
    const indexes = await ArchivedFrame.collection.indexes();
    const expiring = indexes.filter((i: any) => i.expireAfterSeconds !== undefined);
    assert.equal(expiring.length, 0, `archived_frames must not self-expire, found: ${JSON.stringify(expiring)}`);
  });

  it('records the frame time range', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const id = await seed(10);
    const result = await archiveMatch(id);
    const archive = await ArchivedMatch.findById(result!.archiveId).lean();

    assert.equal(archive?.firstFrameAt?.toISOString(), new Date(Date.UTC(2026, 9, 11, 13, 0, 0)).toISOString());
    assert.equal(archive?.lastFrameAt?.toISOString(), new Date(Date.UTC(2026, 9, 11, 13, 0, 9)).toISOString());
  });

  it('handles a match with no frames', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const id = await seed(0);
    const result = await archiveMatch(id);

    assert.equal(result!.frameCount, 0);
    assert.equal(await ArchivedFrame.countDocuments({ archiveId: result!.archiveId }), 0);
  });

  it('returns null for a match that does not exist', async (t) => {
    if (!available) return t.skip('no MongoDB');
    assert.equal(await archiveMatch(new mongoose.Types.ObjectId().toString()), null);
  });

  it('keeps archives separate when the same match is archived twice', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const id = await seed(4);

    const a = await archiveMatch(id);
    const b = await archiveMatch(id);

    assert.notEqual(a!.archiveId, b!.archiveId);
    assert.equal(await ArchivedFrame.countDocuments({ archiveId: a!.archiveId }), 4);
    assert.equal(await ArchivedFrame.countDocuments({ archiveId: b!.archiveId }), 4);
  });

  it('copies a large match without streaming it through Node', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const id = await seed(3000);

    const started = Date.now();
    const result = await archiveMatch(id);
    const elapsed = Date.now() - started;

    assert.equal(await ArchivedFrame.countDocuments({ archiveId: result!.archiveId }), 3000);
    console.log(`      (3000 frames archived in ${elapsed}ms)`);
  });
});
