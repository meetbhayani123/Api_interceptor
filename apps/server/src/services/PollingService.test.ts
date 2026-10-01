import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { startPolling, stopPolling, isPolling, getActivePollIds } from './PollingService.js';

/**
 * Needs a MongoDB. Skipped when none is reachable, so `pnpm test` still passes
 * on a machine (or CI job) without one.
 *
 *   mongod --dbpath /tmp/x --port 27018
 */
const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/polling_test';

let available = false;

before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
    await Match.deleteMany({});
    available = true;
  } catch {
    available = false;
  }
});

after(async () => {
  if (!available) return;
  for (const id of getActivePollIds()) await stopPolling(id);
  await Match.deleteMany({});
  await mongoose.disconnect();
});

describe('startPolling concurrency', () => {
  it('starts a match only once when called concurrently', async (t) => {
    if (!available) return t.skip(`no MongoDB at ${URI}`);

    // No marketId, so executePoll() returns early and never touches the
    // external odds API.
    const match = await Match.create({
      name: 'Concurrency Probe',
      startTime: new Date(),
      status: 'upcoming',
      oddsHistory: [],
    });
    const id = (match._id as any).toString();

    // The scheduler sweep, a user clicking Start, and the post-import hook can
    // all land on the same match at once. startPolling awaits a DB write and a
    // full poll before recording itself, so a guard that is not reserved
    // synchronously lets several callers through — each creating its own
    // setInterval, with only the last one reachable by stopPolling. The rest
    // poll forever and can never be cleared.
    const results = await Promise.all([
      startPolling(id),
      startPolling(id),
      startPolling(id),
    ]);

    const started = results.filter(Boolean).length;
    assert.equal(started, 1, `expected exactly one start, got ${started} — the extra timers are unstoppable`);

    assert.equal(isPolling(id), true);
    assert.equal(getActivePollIds().filter((x) => x === id).length, 1);

    await stopPolling(id);
    assert.equal(isPolling(id), false);
  });

  it('leaves no reservation behind when a start is stopped mid-flight', async (t) => {
    if (!available) return t.skip(`no MongoDB at ${URI}`);

    const match = await Match.create({
      name: 'Stop During Start',
      startTime: new Date(),
      status: 'upcoming',
      oddsHistory: [],
    });
    const id = (match._id as any).toString();

    const starting = startPolling(id);
    await stopPolling(id);
    await starting;

    assert.equal(isPolling(id), false, 'a stop during startup must win, not be overwritten');
  });
});
