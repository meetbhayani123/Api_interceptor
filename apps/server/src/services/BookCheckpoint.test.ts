import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { SavedBook } from '../models/SavedBook.js';
import { recordCheckpoint, checkpointDueAt, checkpointLabel } from './BookCheckpointService.js';
import { DEFAULT_CHECKPOINT_MINUTES } from '@repo/types';

/** Needs a MongoDB; skipped cleanly without one. */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/checkpoint_test';
let available = false;

const MIN = 60_000;

before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
    available = true;
  } catch { available = false; }
});

after(async () => {
  if (!available) return;
  await Promise.all([Match.deleteMany({}), SavedBook.deleteMany({})]);
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([Match.deleteMany({}), SavedBook.deleteMany({})]);
});

/** A match that started `startedMinsAgo` ago with a book already accumulated. */
const makeMatch = (startedMinsAgo: number, over: any = {}) =>
  Match.create({
    name: 'India vs Australia', teamA: 'India', teamB: 'Australia',
    startTime: new Date(Date.now() - startedMinsAgo * MIN),
    status: 'running', oddsHistory: [],
    finalBook: { teamA_PL: 4820.5, teamB_PL: -3110.25 },
    totalSnapshotCount: 800,
    ...over,
  });

describe('the automatic book checkpoint', () => {
  it('saves the running total, tagged with the mark', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch(DEFAULT_CHECKPOINT_MINUTES);
    const id = (match._id as any).toString();

    assert.equal(await recordCheckpoint(id), true);

    const rows = await SavedBook.find({ matchId: id }).lean();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].trigger, 'checkpoint');
    assert.equal(rows[0].label, checkpointLabel());
    // The cumulative book, not a window: everything captured since polling
    // began, including the 30-minute pre-start lead.
    assert.equal(rows[0].teamA_PL, 4820.5);
    assert.equal(rows[0].teamB_PL, -3110.25);
    assert.equal(rows[0].snapshotCount, 800);
  });

  it('records it exactly once when a timer and a sweep both fire', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch(DEFAULT_CHECKPOINT_MINUTES);
    const id = (match._id as any).toString();

    const results = await Promise.all([
      recordCheckpoint(id), recordCheckpoint(id), recordCheckpoint(id),
    ]);

    assert.equal(results.filter(Boolean).length, 1, 'only one call may write it');
    assert.equal(await SavedBook.countDocuments({ matchId: id }), 1);
  });

  it('does not record a second one later in the match', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch(DEFAULT_CHECKPOINT_MINUTES);
    const id = (match._id as any).toString();

    await recordCheckpoint(id);
    assert.equal(await recordCheckpoint(id), false);
    assert.equal(await SavedBook.countDocuments({ matchId: id }), 1);
  });

  it('refuses to backdate a stale checkpoint after an outage', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // Server was down over the mark. Writing the running total an hour late
    // and calling it the "10 min" book would misreport it.
    const match = await makeMatch(DEFAULT_CHECKPOINT_MINUTES + 60);
    const id = (match._id as any).toString();

    assert.equal(await recordCheckpoint(id), false);
    assert.equal(await SavedBook.countDocuments({ matchId: id }), 0);

    // ...and it is not retried every sweep for the rest of the match.
    const after = await Match.findById(id).lean();
    assert.ok(after?.checkpointSavedAt, 'the attempt is marked resolved');
    assert.equal(await recordCheckpoint(id), false);
  });

  it('still records one that fires slightly late', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // A one-minute delay is within tolerance; the figure is still honest.
    const match = await makeMatch(DEFAULT_CHECKPOINT_MINUTES + 1);
    const id = (match._id as any).toString();

    assert.equal(await recordCheckpoint(id), true);
    assert.equal(await SavedBook.countDocuments({ matchId: id }), 1);
  });

  it('skips a match that captured nothing', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // A 0/0 book is noise, not a record.
    const match = await makeMatch(DEFAULT_CHECKPOINT_MINUTES, { totalSnapshotCount: 0, finalBook: undefined });
    const id = (match._id as any).toString();

    assert.equal(await recordCheckpoint(id), false);
    assert.equal(await SavedBook.countDocuments({ matchId: id }), 0);
  });

  it('leaves manual and match-end saves distinguishable', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { recordBook } = await import('./SavedBookService.js');
    const match = await makeMatch(DEFAULT_CHECKPOINT_MINUTES);
    const id = (match._id as any).toString();

    await recordBook(id, { trigger: 'manual' });
    await recordCheckpoint(id);
    await recordBook(id, { trigger: 'auto', reason: 'Market closed' });

    const rows = await SavedBook.find({ matchId: id }).sort({ savedAt: 1 }).lean();
    assert.deepEqual(rows.map((r) => r.trigger), ['manual', 'checkpoint', 'auto']);
    assert.equal(rows[1].label, checkpointLabel());
  });

  it('puts the mark the configured number of minutes after start', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const start = new Date('2026-11-04T17:00:00Z');
    assert.equal(
      new Date(checkpointDueAt(start)).toISOString(),
      new Date(start.getTime() + DEFAULT_CHECKPOINT_MINUTES * MIN).toISOString()
    );
    assert.equal(checkpointLabel(), `${DEFAULT_CHECKPOINT_MINUTES} min`);
  });
});
