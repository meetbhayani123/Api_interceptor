import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';
import { listArchiveFrames } from './archive.controller.js';

/** Needs a MongoDB; skipped cleanly without one. */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/archive_filter_test';
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

// Ten frames, one per minute from 13:00 to 13:09 UTC.
const at = (minute: number) => new Date(Date.UTC(2026, 9, 11, 13, minute, 0));

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
  await Promise.all([ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({})]);
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!available) return;
  await Promise.all([ArchivedMatch.deleteMany({}), ArchivedFrame.deleteMany({})]);

  const archive = await ArchivedMatch.create({
    originalMatchId: 'm1', name: 'Pakistan v Sri Lanka',
    teamA: 'Pakistan', teamB: 'Sri Lanka',
    frameCount: 10, firstFrameAt: at(0), lastFrameAt: at(9), archivedAt: new Date(),
  });
  archiveId = (archive._id as any).toString();

  await ArchivedFrame.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      archiveId: archive._id, originalMatchId: 'm1',
      sequenceId: i + 1, capturedAt: at(i),
      teamA: { odds: [1.9, 1.92], pricing: [100, 200] },
      teamB: { odds: [2.1, 2.12], pricing: [300, 400] },
    }))
  );
});

const minutesOf = (body: any) =>
  body.items.map((f: any) => new Date(f.capturedAt).getUTCMinutes());

describe('frame time filter', () => {
  it('returns everything when no window is given', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await listArchiveFrames(fakeReq({ id: archiveId }), res);

    assert.equal(out.body.total, 10);
    assert.equal(out.body.filtered, false);
  });

  it('filters to a window, inclusive at both ends', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await listArchiveFrames(
      fakeReq({ id: archiveId }, { from: at(3).toISOString(), to: at(6).toISOString() }),
      res
    );

    assert.deepEqual(minutesOf(out.body), [3, 4, 5, 6], 'boundary frames must be included');
    assert.equal(out.body.total, 4);
    assert.equal(out.body.filtered, true);
  });

  it('accepts an open-ended window from one side only', async (t) => {
    if (!available) return t.skip('no MongoDB');

    const { res: r1, out: o1 } = fakeRes();
    await listArchiveFrames(fakeReq({ id: archiveId }, { from: at(7).toISOString() }), r1);
    assert.deepEqual(minutesOf(o1.body), [7, 8, 9]);

    const { res: r2, out: o2 } = fakeRes();
    await listArchiveFrames(fakeReq({ id: archiveId }, { to: at(2).toISOString() }), r2);
    assert.deepEqual(minutesOf(o2.body), [0, 1, 2]);
  });

  it('paginates within the window, not across the whole archive', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const window = { from: at(2).toISOString(), to: at(7).toISOString() };

    const { res, out } = fakeRes();
    await listArchiveFrames(fakeReq({ id: archiveId }, { ...window, page: '2', limit: '3' }), res);

    assert.deepEqual(minutesOf(out.body), [5, 6, 7]);
    assert.equal(out.body.total, 6, 'the count must reflect the window');
    assert.equal(out.body.totalPages, 2);
  });

  it('returns an empty page for a window with no frames', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await listArchiveFrames(
      fakeReq({ id: archiveId }, { from: at(30).toISOString(), to: at(40).toISOString() }),
      res
    );

    assert.equal(out.body.items.length, 0);
    assert.equal(out.body.total, 0);
  });

  it('ignores an unparseable date rather than erroring the page', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await listArchiveFrames(fakeReq({ id: archiveId }, { from: 'not-a-date', to: '' }), res);

    assert.equal(out.code, 200);
    assert.equal(out.body.total, 10);
    assert.equal(out.body.filtered, false);
  });

  it('returns nothing when the window is inverted', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // from after to. Mongo resolves this to an impossible range; the UI blocks
    // it earlier, but the API must not fall back to "everything".
    const { res, out } = fakeRes();
    await listArchiveFrames(
      fakeReq({ id: archiveId }, { from: at(8).toISOString(), to: at(2).toISOString() }),
      res
    );

    assert.equal(out.body.total, 0, 'an inverted window must not silently return all frames');
  });

  it('echoes the applied window back', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const { res, out } = fakeRes();
    await listArchiveFrames(
      fakeReq({ id: archiveId }, { from: at(1).toISOString(), to: at(5).toISOString() }),
      res
    );

    assert.equal(new Date(out.body.from).toISOString(), at(1).toISOString());
    assert.equal(new Date(out.body.to).toISOString(), at(5).toISOString());
  });
});
