import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { SavedBook } from '../models/SavedBook.js';
import { stopPolling } from './PollingService.js';

/**
 * Automatic saving of the final book when a match ends.
 * Needs a MongoDB; skipped cleanly without one.
 */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/autosave_test';
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
  await Promise.all([Match.deleteMany({}), SavedBook.deleteMany({})]);
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([Match.deleteMany({}), SavedBook.deleteMany({})]);
});

const makeMatch = (over: any = {}) =>
  Match.create({
    name: 'Pakistan v Sri Lanka',
    teamA: 'Pakistan',
    teamB: 'Sri Lanka',
    startTime: new Date(),
    status: 'running',
    oddsHistory: [],
    finalBook: { teamA_PL: -30900000, teamB_PL: 229900000 },
    totalSnapshotCount: 5936,
    ...over,
  });

describe('auto-saving the final book', () => {
  it('records the book when a match stops', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    await stopPolling(id, 'Market closed');

    const rows = await SavedBook.find({ matchId: id }).lean();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].teamA_PL, -30900000);
    assert.equal(rows[0].teamB_PL, 229900000);
    assert.equal(rows[0].snapshotCount, 5936);
    assert.equal(rows[0].trigger, 'auto');
    assert.equal(rows[0].reason, 'Market closed');
    assert.equal(rows[0].matchName, 'Pakistan v Sri Lanka');
  });

  it('saves exactly once even when several paths stop the same match', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    // The HTTP route, the failure cut-off and the scheduler sweep can all
    // land on one match. Only the call that actually completes it may save.
    await Promise.all([
      stopPolling(id, 'Market closed'),
      stopPolling(id, 'Polling window elapsed'),
      stopPolling(id, 'Stopped manually'),
    ]);

    assert.equal(
      await SavedBook.countDocuments({ matchId: id }),
      1,
      'concurrent stops must not each write a record'
    );
  });

  it('does not save again for a match that was already completed', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch({ status: 'completed' });
    const id = (match._id as any).toString();

    await stopPolling(id, 'Market closed');

    assert.equal(await SavedBook.countDocuments({ matchId: id }), 0);
  });

  it('records a fresh book each time a match is restarted and stopped', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    await stopPolling(id, 'Stopped manually');
    await Match.findByIdAndUpdate(id, { $set: { status: 'running', finalBook: { teamA_PL: 11, teamB_PL: -11 } } });
    await stopPolling(id, 'Market closed');

    const rows = await SavedBook.find({ matchId: id }).sort({ savedAt: 1 }).lean();
    assert.equal(rows.length, 2);
    assert.equal(rows[1].teamA_PL, 11);
  });

  it('still stops the match if saving fails', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    const create = SavedBook.create;
    (SavedBook as any).create = async () => { throw new Error('disk on fire'); };
    try {
      await stopPolling(id, 'Market closed');
    } finally {
      (SavedBook as any).create = create;
    }

    const after = await Match.findById(id).lean();
    assert.equal(after?.status, 'completed', 'a failed save must not block the stop');
  });

  it('leaves manual saves distinguishable from automatic ones', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { recordBook } = await import('./SavedBookService.js');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    await recordBook(id, { trigger: 'manual' });
    await stopPolling(id, 'Market closed');

    const rows = await SavedBook.find({ matchId: id }).sort({ savedAt: 1 }).lean();
    assert.deepEqual(rows.map((r) => r.trigger), ['manual', 'auto']);
  });
});
