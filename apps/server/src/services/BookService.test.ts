import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNetBook, mapRecord } from '@repo/utils';
import {
  advanceBookHighLow,
  addBookResults,
  calculateSnapshotBook,
  EMPTY_BOOK_HIGH_LOW,
} from './BookService.js';
import type { IBookHighLow } from '@repo/types';

/**
 * The original full-history implementation, kept verbatim as the reference the
 * incremental path must match. advanceBookHighLow() replaced a scan of every
 * snapshot on every 3s poll; if the two ever diverge, the cached peak/trough
 * silently becomes wrong and nothing else would catch it.
 */
function referenceHighLow(snaps: any[]): IBookHighLow {
  let runA = 0, runB = 0, highA = 0, lowA = 0, highB = 0, lowB = 0;
  for (const snap of snaps) {
    const delta = calculateNetBook([mapRecord(snap)]);
    runA += delta.teamA_PL;
    runB += delta.teamB_PL;
    if (runA > highA) highA = runA;
    if (runA < lowA) lowA = runA;
    if (runB > highB) highB = runB;
    if (runB < lowB) lowB = runB;
  }
  return { teamA_high: highA, teamA_low: lowA, teamB_high: highB, teamB_low: lowB };
}

/** The incremental path, exactly as executePoll drives it. */
function incrementalHighLow(snaps: any[]): IBookHighLow {
  let cumulative = { teamA_PL: 0, teamB_PL: 0 };
  let highLow = EMPTY_BOOK_HIGH_LOW;
  for (const snap of snaps) {
    cumulative = addBookResults(cumulative, calculateSnapshotBook(snap));
    highLow = advanceBookHighLow(highLow, cumulative);
  }
  return highLow;
}

/** Deterministic pseudo-random snapshots, so a failure is reproducible. */
function snapshots(count: number, seed: number) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: count }, () => ({
    teamA: { odds: [1 + rnd() * 4, 1 + rnd() * 4], pricing: [rnd() * 60000, rnd() * 60000] },
    teamB: { odds: [1 + rnd() * 4, 1 + rnd() * 4], pricing: [rnd() * 60000, rnd() * 60000] },
  }));
}

const drift = (count: number, towardsA: boolean) =>
  Array.from({ length: count }, () =>
    towardsA
      ? { teamA: { odds: [3, 1.01], pricing: [1000, 0] }, teamB: { odds: [1.01, 3], pricing: [0, 1000] } }
      : { teamA: { odds: [1.01, 3], pricing: [0, 1000] }, teamB: { odds: [3, 1.01], pricing: [1000, 0] } }
  );

describe('advanceBookHighLow', () => {
  it('starts flat and only ever moves outward', () => {
    let hl = advanceBookHighLow(EMPTY_BOOK_HIGH_LOW, { teamA_PL: 50, teamB_PL: -20 });
    assert.deepEqual(hl, { teamA_high: 50, teamA_low: 0, teamB_high: 0, teamB_low: -20 });

    // A reading inside the existing range must not narrow it.
    hl = advanceBookHighLow(hl, { teamA_PL: 10, teamB_PL: -5 });
    assert.deepEqual(hl, { teamA_high: 50, teamA_low: 0, teamB_high: 0, teamB_low: -20 });

    hl = advanceBookHighLow(hl, { teamA_PL: -30, teamB_PL: 75 });
    assert.deepEqual(hl, { teamA_high: 50, teamA_low: -30, teamB_high: 75, teamB_low: -20 });
  });

  it('treats a missing cache as flat rather than throwing', () => {
    assert.deepEqual(
      advanceBookHighLow(null, { teamA_PL: 0, teamB_PL: 0 }),
      EMPTY_BOOK_HIGH_LOW
    );
  });
});

describe('addBookResults', () => {
  it('treats a null base as zero', () => {
    assert.deepEqual(addBookResults(null, { teamA_PL: 5, teamB_PL: -5 }), { teamA_PL: 5, teamB_PL: -5 });
  });
});

describe('incremental high/low matches the full-history scan', () => {
  const cases: Array<[string, any[]]> = [
    ['no history', []],
    ['a single snapshot', snapshots(1, 7)],
    ['a short match', snapshots(30, 11)],
    ['a 4-hour match (4800 frames)', snapshots(4800, 23)],
    ['a book drifting only towards A', drift(50, true)],
    ['a book drifting only towards B', drift(50, false)],
  ];

  for (const [label, snaps] of cases) {
    it(label, () => {
      const want = referenceHighLow(snaps);
      const got = incrementalHighLow(snaps);
      for (const key of ['teamA_high', 'teamA_low', 'teamB_high', 'teamB_low'] as const) {
        assert.ok(
          Math.abs(want[key] - got[key]) < 1e-6,
          `${key}: incremental ${got[key]} != full scan ${want[key]}`
        );
      }
    });
  }
});
