// .mts because apps/web is CommonJS; this forces ESM for the test runner.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayStatus, getCountdown, formatCurrency, getFeedHealth, formatAgo } from './format.ts';

const MIN = 60_000;
const NOW = Date.parse('2026-09-30T12:00:00Z');
const startingIn = (mins: number) => new Date(NOW + mins * MIN);

describe('getDisplayStatus', () => {
  it('shows upcoming for a match nobody is capturing yet', () => {
    assert.equal(
      getDisplayStatus({ status: 'upcoming', isPolling: false, startTime: startingIn(180) }, NOW),
      'upcoming'
    );
  });

  it('shows capturing — not live — while polling ahead of the start', () => {
    // Polling begins 30 minutes early, so status 'running' does NOT mean the
    // match has started. Conflating them showed "LIVE" half an hour too soon.
    assert.equal(
      getDisplayStatus({ status: 'running', isPolling: true, startTime: startingIn(25) }, NOW),
      'capturing'
    );
  });

  it('shows live once the match has actually started', () => {
    assert.equal(
      getDisplayStatus({ status: 'running', isPolling: true, startTime: startingIn(-1) }, NOW),
      'live'
    );
  });

  it('keeps completed even when a stale polling flag is set', () => {
    assert.equal(
      getDisplayStatus({ status: 'completed', isPolling: true, startTime: startingIn(-10) }, NOW),
      'completed'
    );
  });

  it('does not consult the clock before hydration', () => {
    // now === null on the server and first client render. Returning a
    // clock-dependent answer here would cause a hydration mismatch.
    assert.equal(
      getDisplayStatus({ status: 'running', isPolling: true, startTime: startingIn(-5) }, null),
      'capturing'
    );
  });
});

describe('getCountdown', () => {
  it('counts down in hours and minutes when far out', () => {
    assert.equal(getCountdown(startingIn(90), NOW), '1h 30m');
  });

  it('switches to minutes and seconds inside the hour', () => {
    assert.equal(getCountdown(startingIn(5), NOW), '5m 0s');
  });

  it('stops at zero rather than going negative', () => {
    assert.equal(getCountdown(startingIn(-5), NOW), null);
  });

  it('renders nothing before hydration', () => {
    assert.equal(getCountdown(startingIn(90), null), null);
  });
});

describe('formatCurrency', () => {
  it('signs positive and negative values', () => {
    assert.equal(formatCurrency(1234.5), '+ ₹1234.50');
    assert.equal(formatCurrency(-1234.5), '- ₹1234.50');
  });

  it('abbreviates lakhs and crores', () => {
    assert.equal(formatCurrency(150000), '+ ₹1.50L');
    assert.equal(formatCurrency(25000000), '+ ₹2.50Cr');
  });

  it('survives a missing or unparseable value', () => {
    assert.equal(formatCurrency(NaN), '₹0.00');
    assert.equal(formatCurrency(undefined as unknown as number), '₹0.00');
  });
});

describe('getFeedHealth', () => {
  const capturing = { status: 'running', isPolling: true };

  it('reports nothing for a match that is not capturing', () => {
    assert.equal(getFeedHealth({ status: 'upcoming', isPolling: false }, NOW), null);
  });

  it('is ok right after polling starts, before any report', () => {
    assert.equal(getFeedHealth({ ...capturing, lastSuccessfulPollAt: null }, NOW), 'ok');
  });

  it('is ok while captures keep landing', () => {
    const recent = new Date(NOW - 5_000);
    assert.equal(getFeedHealth({ ...capturing, lastSuccessfulPollAt: recent }, NOW), 'ok');
  });

  it('tolerates the persist throttle without crying wolf', () => {
    // Successes are only written every 15s, and a failing poll retries
    // internally for several seconds, so ~20s of silence is still healthy.
    const throttled = new Date(NOW - 20_000);
    assert.equal(getFeedHealth({ ...capturing, lastSuccessfulPollAt: throttled }, NOW), 'ok');
  });

  it('goes stale when nothing has landed for a long time', () => {
    const old = new Date(NOW - 120_000);
    assert.equal(getFeedHealth({ ...capturing, lastSuccessfulPollAt: old }, NOW), 'stale');
  });

  it('reports failing when the server recorded an error', () => {
    assert.equal(
      getFeedHealth(
        { ...capturing, lastSuccessfulPollAt: new Date(NOW - 1000), consecutiveFailures: 3, lastPollError: 'boom' },
        NOW
      ),
      'failing'
    );
  });

  it('reports nothing before hydration', () => {
    assert.equal(getFeedHealth({ ...capturing, lastSuccessfulPollAt: new Date(NOW) }, null), null);
  });
});

describe('formatAgo', () => {
  it('counts seconds, minutes, hours and days', () => {
    assert.equal(formatAgo(new Date(NOW - 12_000), NOW), '12s ago');
    assert.equal(formatAgo(new Date(NOW - 3 * 60_000), NOW), '3m ago');
    assert.equal(formatAgo(new Date(NOW - 5 * 3_600_000), NOW), '5h ago');
    assert.equal(formatAgo(new Date(NOW - 50 * 3_600_000), NOW), '2d ago');
  });

  it('handles clock skew and the pre-hydration case', () => {
    assert.equal(formatAgo(new Date(NOW + 5_000), NOW), 'just now');
    assert.equal(formatAgo(new Date(NOW), null), null);
    assert.equal(formatAgo(null, NOW), null);
  });
});
