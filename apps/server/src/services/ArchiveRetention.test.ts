import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';
import { SavedBook } from '../models/SavedBook.js';
import { purgeExpiredArchives, retentionCutoff } from './ArchiveRetentionService.js';

/** Needs a MongoDB; skipped cleanly without one. */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/archive_retention_test';
let available = false;

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-25T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * DAY);

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

/** An archive made `age` days ago, with `frames` frames. */
async function seedArchive(name: string, age: number, frames = 3) {
  const archive = await ArchivedMatch.create({
    originalMatchId: `m-${name}`, name,
    teamA: 'A', teamB: 'B', frameCount: frames,
    archivedAt: daysAgo(age),
  });
  if (frames > 0) {
    await ArchivedFrame.insertMany(
      Array.from({ length: frames }, (_, i) => ({
        archiveId: archive._id, originalMatchId: `m-${name}`,
        sequenceId: i + 1, capturedAt: daysAgo(age),
        teamA: { odds: [1.9, 1.92], pricing: [100, 200] },
        teamB: { odds: [2.1, 2.12], pricing: [300, 400] },
      }))
    );
  }
  return archive;
}

describe('archive retention', () => {
  it('keeps archives inside the window', async (t) => {
    if (!available) return t.skip('no MongoDB');
    await seedArchive('Yesterday', 1);
    await seedArchive('Two weeks', 14);

    const result = await purgeExpiredArchives(NOW);

    assert.equal(result.archivesDeleted, 0);
    assert.equal(await ArchivedMatch.countDocuments({}), 2);
    assert.equal(await ArchivedFrame.countDocuments({}), 6);
  });

  it('purges archives past the window, frames included', async (t) => {
    if (!available) return t.skip('no MongoDB');
    await seedArchive('Old', 20, 5);
    await seedArchive('Recent', 2, 5);

    const result = await purgeExpiredArchives(NOW);

    assert.equal(result.archivesDeleted, 1);
    assert.equal(result.framesDeleted, 5);
    assert.deepEqual(
      (await ArchivedMatch.find({}).lean()).map((a) => a.name),
      ['Recent'],
      'only the expired archive should go'
    );
    assert.equal(await ArchivedFrame.countDocuments({}), 5, 'the surviving archive keeps its frames');
  });

  it('leaves no orphaned frames behind', async (t) => {
    if (!available) return t.skip('no MongoDB');
    const old = await seedArchive('Old', 30, 8);
    await purgeExpiredArchives(NOW);

    assert.equal(await ArchivedFrame.countDocuments({ archiveId: old._id }), 0);
    assert.equal(await ArchivedFrame.countDocuments({}), 0);
  });

  it('never touches saved books', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // Saved books are a separate, permanent record. Purging archives must not
    // reach them, however old they are.
    await seedArchive('Old', 40);
    await SavedBook.create({
      matchId: 'm-Old', matchName: 'Old', teamA: 'A', teamB: 'B',
      teamA_PL: 10, teamB_PL: -10, snapshotCount: 3,
      trigger: 'auto', savedAt: daysAgo(40),
    });

    await purgeExpiredArchives(NOW);

    assert.equal(await ArchivedMatch.countDocuments({}), 0, 'the archive goes');
    assert.equal(await SavedBook.countDocuments({}), 1, 'the saved book stays');
  });

  it('treats the boundary consistently', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // Just inside stays, comfortably outside goes.
    await seedArchive('Just inside', 14.9, 1);
    await seedArchive('Just outside', 15.1, 1);

    await purgeExpiredArchives(NOW);

    assert.deepEqual((await ArchivedMatch.find({}).lean()).map((a) => a.name), ['Just inside']);
  });

  it('clears a backlog larger than one batch', async (t) => {
    if (!available) return t.skip('no MongoDB');
    // A service asleep for a long stretch wakes to many expired archives; one
    // sweep must drain them all, not just the first batch of 100.
    const docs = Array.from({ length: 230 }, (_, i) => ({
      originalMatchId: `bulk-${i}`, name: `Bulk ${i}`,
      teamA: 'A', teamB: 'B', frameCount: 0, archivedAt: daysAgo(40),
    }));
    await ArchivedMatch.insertMany(docs);

    const result = await purgeExpiredArchives(NOW);

    assert.equal(result.archivesDeleted, 230);
    assert.equal(await ArchivedMatch.countDocuments({}), 0);
  });

  it('is a no-op on an empty database', async (t) => {
    if (!available) return t.skip('no MongoDB');
    assert.deepEqual(await purgeExpiredArchives(NOW), { archivesDeleted: 0, framesDeleted: 0 });
  });

  it('puts the cutoff 15 days back by default', async (t) => {
    if (!available) return t.skip('no MongoDB');
    assert.equal(retentionCutoff(NOW).toISOString(), daysAgo(15).toISOString());
  });
});
