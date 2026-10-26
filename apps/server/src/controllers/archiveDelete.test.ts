import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';
import { SavedBook } from '../models/SavedBook.js';
import { deleteArchive } from './archive.controller.js';

/** Needs a MongoDB; skipped cleanly without one. */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/archive_delete_test';
let available = false;

function fakeRes() {
  const out: { code: number; body: any } = { code: 200, body: undefined };
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { out.body = b; return res; },
  };
  return { res, out };
}
const fakeReq = (params: any) => ({ params, query: {} }) as any;

before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
    available = true;
  } catch { available = false; }
});

after(async () => {
  if (!available) return;
  await Promise.all([ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({}), SavedBook.deleteMany({})]);
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({}), SavedBook.deleteMany({})]);
});

async function seed(name: string, frames = 4) {
  const archive = await ArchivedMatch.create({
    originalMatchId: `m-${name}`, name, teamA: 'A', teamB: 'B',
    frameCount: frames, archivedAt: new Date(),
  });
  if (frames > 0) {
    await ArchivedFrame.insertMany(Array.from({ length: frames }, (_, i) => ({
      archiveId: archive._id, originalMatchId: `m-${name}`,
      sequenceId: i + 1, capturedAt: new Date(),
      teamA: { odds: [1.9, 1.92], pricing: [100, 200] },
      teamB: { odds: [2.1, 2.12], pricing: [300, 400] },
    })));
  }
  return archive;
}

describe('deleting an archive', () => {
  it('removes the archive and its frames', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const archive = await seed('Doomed', 6);

    const { res, out } = fakeRes();
    await deleteArchive(fakeReq({ id: (archive._id as any).toString() }), res);

    assert.equal(out.code, 200);
    assert.equal(out.body.framesDeleted, 6);
    assert.equal(await ArchivedMatch.countDocuments({}), 0);
    assert.equal(await ArchivedFrame.countDocuments({}), 0);
  });

  it('leaves other archives alone', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const doomed = await seed('Doomed', 3);
    await seed('Keeper', 5);

    const { res } = fakeRes();
    await deleteArchive(fakeReq({ id: (doomed._id as any).toString() }), res);

    assert.deepEqual((await ArchivedMatch.find({}).lean()).map((a) => a.name), ['Keeper']);
    assert.equal(await ArchivedFrame.countDocuments({}), 5, "the other archive keeps its frames");
  });

  it('never touches saved books', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const archive = await seed('Doomed', 2);
    await SavedBook.create({
      matchId: 'm-Doomed', matchName: 'Doomed', teamA: 'A', teamB: 'B',
      teamA_PL: 1, teamB_PL: -1, snapshotCount: 2, trigger: 'manual', savedAt: new Date(),
    });

    const { res } = fakeRes();
    await deleteArchive(fakeReq({ id: (archive._id as any).toString() }), res);

    assert.equal(await ArchivedMatch.countDocuments({}), 0);
    assert.equal(await SavedBook.countDocuments({}), 1, 'the saved book survives');
  });

  it('handles an archive with no frames', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const archive = await seed('Empty', 0);

    const { res, out } = fakeRes();
    await deleteArchive(fakeReq({ id: (archive._id as any).toString() }), res);

    assert.equal(out.code, 200);
    assert.equal(out.body.framesDeleted, 0);
  });

  it('404s for an id that does not exist', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await deleteArchive(fakeReq({ id: new mongoose.Types.ObjectId().toString() }), res);
    assert.equal(out.code, 404);
  });

  it('404s for a malformed id rather than throwing', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await deleteArchive(fakeReq({ id: 'not-an-object-id' }), res);
    assert.equal(out.code, 404);
  });

  it('is idempotent — deleting twice is not an error the second time', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const archive = await seed('Twice', 2);
    const id = (archive._id as any).toString();

    const first = fakeRes();
    await deleteArchive(fakeReq({ id }), first.res);
    const second = fakeRes();
    await deleteArchive(fakeReq({ id }), second.res);

    assert.equal(first.out.code, 200);
    assert.equal(second.out.code, 404, 'a second delete reports it is already gone');
  });
});
