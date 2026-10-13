import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';
import { locateFrame } from './archive.controller.js';

/** Needs a MongoDB; skipped cleanly without one. */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/archive_locate_test';
let available = false;
let archiveId: string;

function fakeRes() {
  const out: { code: number; body: any } = { code: 200, body: undefined };
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { out.body = b; return res; },
  };
  return { res, out };
}
const fakeReq = (params: any, query: any = {}) => ({ params, query }) as any;

// 120 frames, one every 30 seconds from 13:00:00 UTC.
const FRAMES = 120;
const at = (i: number) => new Date(Date.UTC(2026, 9, 11, 13, 0, 0) + i * 30_000);

before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
    available = true;
  } catch { available = false; }
});

after(async () => {
  if (!available) return;
  await Promise.all([ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({})]);
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({})]);

  const archive = await ArchivedMatch.create({
    originalMatchId: 'm1', name: 'Pakistan v Sri Lanka',
    teamA: 'Pakistan', teamB: 'Sri Lanka',
    frameCount: FRAMES, firstFrameAt: at(0), lastFrameAt: at(FRAMES - 1),
    archivedAt: new Date(),
  });
  archiveId = (archive._id as any).toString();

  await ArchivedFrame.insertMany(
    Array.from({ length: FRAMES }, (_, i) => ({
      archiveId: archive._id, originalMatchId: 'm1',
      sequenceId: i + 1, capturedAt: at(i),
      teamA: { odds: [1.9, 1.92], pricing: [100, 200] },
      teamB: { odds: [2.1, 2.12], pricing: [300, 400] },
    }))
  );
});

const locate = async (query: any) => {
  const { res, out } = fakeRes();
  await locateFrame(fakeReq({ id: archiveId }, query), res);
  return out;
};

describe('locating a moment in the frame table', () => {
  it('sends the first frame to page 1', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const out = await locate({ at: at(0).toISOString(), limit: '50' });
    assert.equal(out.body.page, 1);
    assert.equal(out.body.sequenceId, 1);
  });

  it('finds the page holding a mid-capture moment', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // Frame 60 (0-indexed) is the 61st row; with 50 per page that is page 2.
    const out = await locate({ at: at(60).toISOString(), limit: '50' });
    assert.equal(out.body.page, 2);
    assert.equal(out.body.position, 61);
    assert.equal(out.body.sequenceId, 61);
  });

  it('respects the page size when working out the page', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // The same frame sits on a different page at a different page size.
    assert.equal((await locate({ at: at(60).toISOString(), limit: '20' })).body.page, 4);
    assert.equal((await locate({ at: at(60).toISOString(), limit: '100' })).body.page, 1);
  });

  it('lands on the next frame when the time falls between captures', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // Frames are 30s apart; ask for 15s past frame 10.
    const between = new Date(at(10).getTime() + 15_000);
    const out = await locate({ at: between.toISOString(), limit: '50' });

    assert.equal(out.body.sequenceId, 12, 'should resolve forward to the next capture');
    assert.equal(new Date(out.body.capturedAt).toISOString(), at(11).toISOString());
  });

  it('clamps a time before the capture started to page 1', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const out = await locate({ at: new Date(at(0).getTime() - 3_600_000).toISOString(), limit: '50' });
    assert.equal(out.body.page, 1);
    assert.equal(out.body.sequenceId, 1);
  });

  it('clamps a time after the capture ended to the last page', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const out = await locate({ at: new Date(at(FRAMES).getTime() + 3_600_000).toISOString(), limit: '50' });

    // 120 frames at 50 per page is 3 pages; without clamping this would be 4.
    assert.equal(out.body.totalPages, 3);
    assert.equal(out.body.page, 3);
    assert.equal(out.body.afterLastFrame, true);
    assert.equal(out.body.sequenceId, FRAMES, 'falls back to the final frame');
  });

  it('lands on the last frame exactly', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const out = await locate({ at: at(FRAMES - 1).toISOString(), limit: '50' });
    assert.equal(out.body.page, 3);
    assert.equal(out.body.sequenceId, FRAMES);
    assert.equal(out.body.afterLastFrame, false);
  });

  it('rejects a missing or unparseable time', async (t) => {
    if (!available) return t.skip('no MongoDB');
    assert.equal((await locate({})).code, 400);
    assert.equal((await locate({ at: 'tomorrow-ish' })).code, 400);
  });

  it('404s for an archive with no frames', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const empty = await ArchivedMatch.create({
      originalMatchId: 'm2', name: 'Empty', frameCount: 0, archivedAt: new Date(),
    });
    const { res, out } = fakeRes();
    await locateFrame(fakeReq({ id: (empty._id as any).toString() }, { at: at(0).toISOString() }), res);
    assert.equal(out.code, 404);
  });
});
