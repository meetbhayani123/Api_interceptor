import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { SavedBook } from '../models/SavedBook.js';
import { saveBook, listSavedBookMatches, listSavedBooksForMatch } from './savedBook.controller.js';

/**
 * Needs a MongoDB; skipped cleanly without one.
 *   mongod --dbpath /tmp/x --port 27018
 */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/saved_books_test';
let available = false;

/** Minimal Express double — enough to capture status and body. */
function fakeRes() {
  const out: { code: number; body: any } = { code: 200, body: undefined };
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { out.body = b; return res; },
  };
  return { res, out };
}
const fakeReq = (params: any = {}, query: any = {}) => ({ params, query }) as any;

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
    name: 'India vs Australia',
    teamA: 'India',
    teamB: 'Australia',
    startTime: new Date(),
    status: 'running',
    oddsHistory: [],
    finalBook: { teamA_PL: 1234.5, teamB_PL: -987.25 },
    totalSnapshotCount: 42,
    ...over,
  });

describe('saveBook', () => {
  it('records the current book with a timestamp', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    const { res, out } = fakeRes();
    await saveBook(fakeReq({ id }), res);

    assert.equal(out.code, 201);
    const rows = await SavedBook.find({ matchId: id }).lean();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].teamA_PL, 1234.5);
    assert.equal(rows[0].teamB_PL, -987.25);
    assert.equal(rows[0].snapshotCount, 42);
    assert.ok(rows[0].savedAt instanceof Date);
  });

  it('copies the match and team names in, so the record outlives the match', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    const { res } = fakeRes();
    await saveBook(fakeReq({ id }), res);

    // The whole point of saving is permanence: deleting the match must not
    // render the saved record unreadable.
    await Match.findByIdAndDelete(id);

    const { res: res2, out: out2 } = fakeRes();
    await listSavedBooksForMatch(fakeReq({ matchId: id }, {}), res2);

    assert.equal(out2.code, 200);
    assert.equal(out2.body.matchName, 'India vs Australia');
    assert.equal(out2.body.items[0].teamA, 'India');
  });

  it('keeps every save, so the same match builds a history', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    for (const pl of [10, 20, 30]) {
      await Match.findByIdAndUpdate(id, { $set: { finalBook: { teamA_PL: pl, teamB_PL: -pl } } });
      const { res } = fakeRes();
      await saveBook(fakeReq({ id }), res);
    }

    assert.equal(await SavedBook.countDocuments({ matchId: id }), 3);
  });

  it('saves a flat book for a match with no frames yet', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch({ finalBook: undefined, totalSnapshotCount: 0 });
    const id = (match._id as any).toString();

    const { res, out } = fakeRes();
    await saveBook(fakeReq({ id }), res);

    // No snapshots means calculateMatchBook returns a flat 0/0 book, which is
    // a legitimate thing to record, so this must still succeed rather than
    // silently writing nothing.
    assert.equal(out.code, 201);
    const row = await SavedBook.findOne({ matchId: id }).lean();
    assert.equal(row?.teamA_PL, 0);
  });

  it('404s for a match that does not exist', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await saveBook(fakeReq({ id: new mongoose.Types.ObjectId().toString() }), res);
    assert.equal(out.code, 404);
  });
});

describe('listSavedBookMatches', () => {
  async function seed() {
    const names = ['India vs Australia', 'England vs South Africa', 'Mumbai vs Chennai'];
    const ids: string[] = [];
    for (let i = 0; i < names.length; i++) {
      const m = await makeMatch({ name: names[i] });
      const id = (m._id as any).toString();
      ids.push(id);
      // Two saves each, staggered so ordering is deterministic.
      for (let k = 0; k < 2; k++) {
        await SavedBook.create({
          matchId: id, matchName: names[i], teamA: 'A', teamB: 'B',
          teamA_PL: i * 100 + k, teamB_PL: -(i * 100 + k), snapshotCount: 1,
          savedAt: new Date(Date.UTC(2026, 0, 1 + i, 0, k)),
        });
      }
    }
    return ids;
  }

  it('returns one row per match, most recently saved first', async (t) => {
    if (!available) return t.skip('no MongoDB');
    await seed();

    const { res, out } = fakeRes();
    await listSavedBookMatches(fakeReq({}, {}), res);

    assert.equal(out.body.items.length, 3);
    assert.equal(out.body.total, 3);
    assert.deepEqual(
      out.body.items.map((i: any) => i.matchName),
      ['Mumbai vs Chennai', 'England vs South Africa', 'India vs Australia']
    );
    assert.equal(out.body.items[0].saveCount, 2);
  });

  it('searches by match name, case-insensitively', async (t) => {
    if (!available) return t.skip('no MongoDB');
    await seed();

    const { res, out } = fakeRes();
    await listSavedBookMatches(fakeReq({}, { search: 'ENGLAND' }), res);

    assert.equal(out.body.items.length, 1);
    assert.equal(out.body.items[0].matchName, 'England vs South Africa');
  });

  it('treats regex characters in the search as literal text', async (t) => {
    if (!available) return t.skip('no MongoDB');
    await seed();

    // Unescaped, ".*" would match every row.
    const { res, out } = fakeRes();
    await listSavedBookMatches(fakeReq({}, { search: '.*' }), res);

    assert.equal(out.body.items.length, 0, 'a regex in the search box must not match everything');
  });

  it('paginates', async (t) => {
    if (!available) return t.skip('no MongoDB');
    await seed();

    const { res, out } = fakeRes();
    await listSavedBookMatches(fakeReq({}, { page: '2', limit: '2' }), res);

    assert.equal(out.body.items.length, 1);
    assert.equal(out.body.page, 2);
    assert.equal(out.body.total, 3);
    assert.equal(out.body.totalPages, 2);
  });

  it('clamps a hostile page size', async (t) => {
    if (!available) return t.skip('no MongoDB');
    await seed();
    const { res, out } = fakeRes();
    await listSavedBookMatches(fakeReq({}, { limit: '100000' }), res);
    assert.equal(out.body.limit, 100);
  });
});

describe('listSavedBooksForMatch', () => {
  it('returns a match history newest first', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const match = await makeMatch();
    const id = (match._id as any).toString();

    for (let k = 0; k < 3; k++) {
      await SavedBook.create({
        matchId: id, matchName: 'India vs Australia', teamA: 'India', teamB: 'Australia',
        teamA_PL: k, teamB_PL: -k, snapshotCount: k,
        savedAt: new Date(Date.UTC(2026, 0, 1, 0, k)),
      });
    }

    const { res, out } = fakeRes();
    await listSavedBooksForMatch(fakeReq({ matchId: id }, {}), res);

    assert.deepEqual(out.body.items.map((i: any) => i.teamA_PL), [2, 1, 0]);
    assert.equal(out.body.total, 3);
  });

  it('404s when a match has no saves', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await listSavedBooksForMatch(fakeReq({ matchId: 'nope' }, {}), res);
    assert.equal(out.code, 404);
  });
});
