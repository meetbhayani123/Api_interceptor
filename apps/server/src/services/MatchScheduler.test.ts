import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decidePolling, pollingStartsAt, pollingExpiresAt } from './MatchScheduler.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

// Fixed "now" so these never depend on the wall clock.
const NOW = Date.parse('2026-09-30T12:00:00Z');
const startingIn = (mins: number) => new Date(NOW + mins * MIN);

describe('polling window boundaries', () => {
  it('opens 30 minutes before the match starts', () => {
    const start = startingIn(0);
    assert.equal(pollingStartsAt(start), start.getTime() - 30 * MIN);
  });

  it('closes MAX_POLL_HOURS after the match starts (12h by default)', () => {
    const start = startingIn(0);
    assert.equal(pollingExpiresAt(start), start.getTime() + 12 * HOUR);
  });
});

describe('decidePolling', () => {
  const schedules: Array<[string, number, number]> = [
    ['a match 2 hours out', 120, 90 * MIN],
    ['a match 31 minutes out', 31, 1 * MIN],
  ];

  for (const [label, mins, delayMs] of schedules) {
    it(`arms a timer for ${label}`, () => {
      const decision = decidePolling(startingIn(mins), NOW);
      assert.equal(decision.action, 'schedule');
      assert.equal(decision.action === 'schedule' && decision.delayMs, delayMs);
    });
  }

  const starts: Array<[string, number]> = [
    ['exactly 30 minutes out — the boundary is inclusive', 30],
    ['29 minutes out', 29],
    ['starting right now', 0],
    // Anything already under way but inside the window is a restart-recovery
    // resume: the process lost its in-memory timer, the match is still live.
    ['started an hour ago (restart recovery)', -60],
    ['started 11h59m ago, still inside the window', -719],
  ];

  for (const [label, mins] of starts) {
    it(`starts polling for a match ${label}`, () => {
      assert.equal(decidePolling(startingIn(mins), NOW).action, 'start');
    });
  }

  const expired: Array<[string, number]> = [
    ['exactly 12 hours ago — the boundary is inclusive', -720],
    ['13 hours ago', -780],
    ['three days ago (a stale import)', -4320],
  ];

  for (const [label, mins] of expired) {
    it(`refuses to start a match that began ${label}`, () => {
      assert.equal(decidePolling(startingIn(mins), NOW).action, 'expired');
    });
  }
});
