import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

/**
 * Poll-health behaviour. Needs a MongoDB; skipped cleanly without one.
 *
 *   mongod --dbpath /tmp/x --port 27018
 *
 * Config is read at import time, so the thresholds are set first and the
 * modules pulled in dynamically — otherwise this would take a minute to run.
 */
process.env.MAX_CONSECUTIVE_FAILURES = '2';
process.env.POLLING_INTERVAL_MS = '50';

const URI = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27018/polling_health_test';

let available = false;
let Match: typeof import('../models/Match.js').Match;
let startPolling: typeof import('./PollingService.js').startPolling;
let stopPolling: typeof import('./PollingService.js').stopPolling;
let isPolling: typeof import('./PollingService.js').isPolling;
let getActivePollIds: typeof import('./PollingService.js').getActivePollIds;

before(async () => {
  ({ Match } = await import('../models/Match.js'));
  ({ startPolling, stopPolling, isPolling, getActivePollIds } = await import('./PollingService.js'));
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

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('poll health', () => {
  it('records why a poll failed instead of only logging it', async (t) => {
    if (!available) return t.skip(`no MongoDB at ${URI}`);

    // A marketId that fails OddsService's own validation, so the poll throws
    // immediately and nothing is sent to the external API.
    const match = await Match.create({
      name: 'Broken Feed',
      marketId: 'not a valid market id!',
      startTime: new Date(),
      status: 'upcoming',
      oddsHistory: [],
    });
    const id = (match._id as any).toString();

    await startPolling(id);
    await settle(80);

    const after1 = await Match.findById(id).lean();
    assert.ok((after1?.consecutiveFailures ?? 0) >= 1, 'failures should be counted');
    assert.match(
      after1?.lastPollError ?? '',
      /Invalid marketId/,
      'the reason should be stored, not just written to a log nobody reads'
    );

    await stopPolling(id);
  });

  it('stops a match once failures pass the threshold', async (t) => {
    if (!available) return t.skip(`no MongoDB at ${URI}`);

    const match = await Match.create({
      name: 'Hopeless Feed',
      marketId: 'still !! invalid',
      startTime: new Date(),
      status: 'upcoming',
      oddsHistory: [],
    });
    const id = (match._id as any).toString();

    await startPolling(id);

    // Threshold is 2 and the interval is 50ms, so this resolves quickly.
    // Without the cut-off, a dead feed would be retried until the 12h window.
    for (let i = 0; i < 40 && isPolling(id); i++) await settle(50);

    assert.equal(isPolling(id), false, 'a persistently failing feed must stop polling itself');

    const settled = await Match.findById(id).lean();
    assert.equal(settled?.status, 'completed');
    assert.ok((settled?.consecutiveFailures ?? 0) >= 2);
    assert.ok(settled?.lastPollError, 'the failure reason survives the stop');
  });
});
