// .mts because apps/web is CommonJS; this forces ESM for the test runner.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDisplayStatus, getCountdown, formatCurrency } from './format.ts';

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
