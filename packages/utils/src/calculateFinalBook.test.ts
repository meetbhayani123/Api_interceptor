import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNetBook, mapRecord, type BookResult } from './calculateFinalBook.ts';

/** Build a mapped record, defaulting every unused leg to a no-op. */
const record = (over: Partial<Parameters<typeof calculateNetBook>[0][number]> = {}) => ({
  teamA_back_odd: 1, teamA_lay_odd: 1, teamA_back_price: 0, teamA_lay_price: 0,
  teamB_back_odd: 1, teamB_lay_odd: 1, teamB_back_price: 0, teamB_lay_price: 0,
  ...over,
});

const close = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: got ${actual}, expected ${expected}`);

describe('calculateNetBook', () => {
  it('returns a flat book for no records', () => {
    assert.deepEqual(calculateNetBook([]), { teamA_PL: 0, teamB_PL: 0 });
  });

  it('prices a single back bet on team A', () => {
    // 100 staked at 2.0: win 100 if A wins, lose the 100 stake if B wins.
    const book = calculateNetBook([record({ teamA_back_odd: 2, teamA_back_price: 100 })]);
    close(book.teamA_PL, 100, 'A wins');
    close(book.teamB_PL, -100, 'B wins');
  });

  it('prices a single lay bet on team A as the mirror of backing it', () => {
    // Laying is the other side of the same wager.
    const book = calculateNetBook([record({ teamA_lay_odd: 2, teamA_lay_price: 100 })]);
    close(book.teamA_PL, -100, 'A wins');
    close(book.teamB_PL, 100, 'B wins');
  });

  it('cancels out when the same price is backed and laid at the same odds', () => {
    const book = calculateNetBook([
      record({ teamA_back_odd: 2, teamA_back_price: 100, teamA_lay_odd: 2, teamA_lay_price: 100 }),
    ]);
    close(book.teamA_PL, 0, 'A wins');
    close(book.teamB_PL, 0, 'B wins');
  });

  it('computes a mixed four-leg book', () => {
    // A back 100@2.0, A lay 50@2.1, B back 80@2.2, B lay 40@2.3
    //   A wins: +100 - 55 - 80 + 40 =  5
    //   B wins: -100 + 50 + 96 - 52 = -6
    const book = calculateNetBook([
      record({
        teamA_back_odd: 2.0, teamA_back_price: 100, teamA_lay_odd: 2.1, teamA_lay_price: 50,
        teamB_back_odd: 2.2, teamB_back_price: 80,  teamB_lay_odd: 2.3, teamB_lay_price: 40,
      }),
    ]);
    close(book.teamA_PL, 5, 'A wins');
    close(book.teamB_PL, -6, 'B wins');
  });

  it('sums across records, which is what makes the running book incremental', () => {
    const one = record({ teamA_back_odd: 2, teamA_back_price: 100 });
    const two = record({ teamB_back_odd: 3, teamB_back_price: 50 });

    const combined = calculateNetBook([one, two]);
    const separate: BookResult = {
      teamA_PL: calculateNetBook([one]).teamA_PL + calculateNetBook([two]).teamA_PL,
      teamB_PL: calculateNetBook([one]).teamB_PL + calculateNetBook([two]).teamB_PL,
    };

    close(combined.teamA_PL, separate.teamA_PL, 'A wins');
    close(combined.teamB_PL, separate.teamB_PL, 'B wins');
  });
});

describe('mapRecord', () => {
  it('unpacks the [back, lay] snapshot arrays into named legs', () => {
    const mapped = mapRecord({
      teamA: { odds: [1.88, 1.9], pricing: [24500, 18900] },
      teamB: { odds: [2.12, 2.16], pricing: [31200, 27750] },
    });

    assert.deepEqual(mapped, {
      teamA_back_odd: 1.88, teamA_lay_odd: 1.9,
      teamA_back_price: 24500, teamA_lay_price: 18900,
      teamB_back_odd: 2.12, teamB_lay_odd: 2.16,
      teamB_back_price: 31200, teamB_lay_price: 27750,
    });
  });
});
