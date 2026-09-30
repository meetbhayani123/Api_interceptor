import { calculateNetBook, mapRecord } from '@repo/utils';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import type { IBookResult, IBookHighLow } from '@repo/types';

/**
 * The per-snapshot P/L expression, as a Mongo aggregation accumulator.
 *
 * This mirrors calculateNetBook() in @repo/utils. It lives in one place so the
 * two cannot drift: every aggregate below builds its $group from this.
 */
function bookAccumulators() {
  const backMinusOne = (team: 'teamA' | 'teamB') => ({
    $subtract: [{ $arrayElemAt: [`$${team}.odds`, 0] }, 1],
  });
  const layMinusOne = (team: 'teamA' | 'teamB') => ({
    $subtract: [{ $arrayElemAt: [`$${team}.odds`, 1] }, 1],
  });
  const price = (team: 'teamA' | 'teamB', side: 0 | 1) => ({
    $arrayElemAt: [`$${team}.pricing`, side],
  });

  return {
    // P/L if team A wins: A's back pays out, A's lay pays out against us,
    // B's back is lost, B's lay is kept.
    teamA_PL: {
      $sum: {
        $add: [
          { $multiply: [backMinusOne('teamA'), price('teamA', 0)] },
          { $multiply: [-1, layMinusOne('teamA'), price('teamA', 1)] },
          { $multiply: [-1, price('teamB', 0)] },
          price('teamB', 1),
        ],
      },
    },
    // P/L if team B wins: the mirror image.
    teamB_PL: {
      $sum: {
        $add: [
          { $multiply: [-1, price('teamA', 0)] },
          price('teamA', 1),
          { $multiply: [backMinusOne('teamB'), price('teamB', 0)] },
          { $multiply: [-1, layMinusOne('teamB'), price('teamB', 1)] },
        ],
      },
    },
  };
}

/** Run the book aggregation over whatever set of snapshots `match` selects. */
async function aggregateBook(match: Record<string, unknown>): Promise<IBookResult> {
  const [result] = await OddsSnapshot.aggregate<IBookResult & { _id: null }>([
    { $match: match },
    { $group: { _id: null, ...bookAccumulators() } },
  ]).exec();

  if (!result) return { teamA_PL: 0, teamB_PL: 0 };

  return {
    teamA_PL: result.teamA_PL ?? 0,
    teamB_PL: result.teamB_PL ?? 0,
  };
}

/**
 * Final book P/L for a match, across all its snapshots.
 */
export function calculateMatchBook(matchId: string): Promise<IBookResult> {
  return aggregateBook({ matchId });
}

/**
 * Book P/L restricted to a time window (used for the rolling 5-minute view).
 */
export function calculateMatchBookInTimeRange(
  matchId: string,
  startTime: Date,
  endTime: Date = new Date()
): Promise<IBookResult> {
  return aggregateBook({
    matchId,
    capturedAt: { $gte: startTime, $lte: endTime },
  });
}

export function calculateSnapshotBook(
  snapshot: Pick<Parameters<typeof mapRecord>[0], 'teamA' | 'teamB'>
): IBookResult {
  return calculateNetBook([mapRecord(snapshot)]);
}

export function addBookResults(base: IBookResult | null | undefined, delta: IBookResult): IBookResult {
  return {
    teamA_PL: (base?.teamA_PL ?? 0) + delta.teamA_PL,
    teamB_PL: (base?.teamB_PL ?? 0) + delta.teamB_PL,
  };
}

export const EMPTY_BOOK_HIGH_LOW: IBookHighLow = {
  teamA_high: 0,
  teamA_low: 0,
  teamB_high: 0,
  teamB_low: 0,
};

/**
 * Fold one more cumulative book reading into the running high/low.
 *
 * The peak and trough track the *cumulative* book over time, and the cumulative
 * book is already maintained incrementally as `finalBook` — so extending the
 * high/low is O(1) and needs no history. Baselines start at 0, matching the
 * full-history scan below.
 */
export function advanceBookHighLow(
  previous: IBookHighLow | null | undefined,
  cumulative: IBookResult
): IBookHighLow {
  const prev = previous ?? EMPTY_BOOK_HIGH_LOW;

  return {
    teamA_high: Math.max(prev.teamA_high, cumulative.teamA_PL),
    teamA_low: Math.min(prev.teamA_low, cumulative.teamA_PL),
    teamB_high: Math.max(prev.teamB_high, cumulative.teamB_PL),
    teamB_low: Math.min(prev.teamB_low, cumulative.teamB_PL),
  };
}

/**
 * Full-history scan of the cumulative peak and trough.
 *
 * This is the backfill path only — for matches recorded before the high/low was
 * cached, or whose cache is missing. The live path uses advanceBookHighLow().
 * Streamed with a cursor so a long match is never held in memory at once.
 */
export async function calculateMatchBookHighLow(matchId: string): Promise<IBookHighLow> {
  const cursor = OddsSnapshot.find({ matchId })
    .sort({ capturedAt: 1 })
    .select({ teamA: 1, teamB: 1 })
    .lean()
    .cursor();

  let running: IBookResult = { teamA_PL: 0, teamB_PL: 0 };
  let highLow: IBookHighLow = EMPTY_BOOK_HIGH_LOW;

  for await (const snap of cursor) {
    running = addBookResults(running, calculateSnapshotBook(snap));
    highLow = advanceBookHighLow(highLow, running);
  }

  return highLow;
}
