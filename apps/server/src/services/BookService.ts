import { calculateNetBook, mapRecord } from '@repo/utils';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import type { IBookResult, IBookHighLow } from '@repo/types';

/**
 * Calculates the final book P/L for a given match from all its snapshots.
 * This is a thin orchestration layer — the actual math lives in @repo/utils.
 */
export async function calculateMatchBook(matchId: string): Promise<IBookResult> {
  const [result] = await OddsSnapshot.aggregate<IBookResult & { _id: null }>([
    { $match: { matchId } },
    {
      $group: {
        _id: null,
        teamA_PL: {
          $sum: {
            $add: [
              {
                $multiply: [
                  { $subtract: [{ $arrayElemAt: ['$teamA.odds', 0] }, 1] },
                  { $arrayElemAt: ['$teamA.pricing', 0] },
                ],
              },
              {
                $multiply: [
                  -1,
                  { $subtract: [{ $arrayElemAt: ['$teamA.odds', 1] }, 1] },
                  { $arrayElemAt: ['$teamA.pricing', 1] },
                ],
              },
              { $multiply: [-1, { $arrayElemAt: ['$teamB.pricing', 0] }] },
              { $arrayElemAt: ['$teamB.pricing', 1] },
            ],
          },
        },
        teamB_PL: {
          $sum: {
            $add: [
              { $multiply: [-1, { $arrayElemAt: ['$teamA.pricing', 0] }] },
              { $arrayElemAt: ['$teamA.pricing', 1] },
              {
                $multiply: [
                  { $subtract: [{ $arrayElemAt: ['$teamB.odds', 0] }, 1] },
                  { $arrayElemAt: ['$teamB.pricing', 0] },
                ],
              },
              {
                $multiply: [
                  -1,
                  { $subtract: [{ $arrayElemAt: ['$teamB.odds', 1] }, 1] },
                  { $arrayElemAt: ['$teamB.pricing', 1] },
                ],
              },
            ],
          },
        },
      },
    },
  ]).exec();

  if (!result) {
    return { teamA_PL: 0, teamB_PL: 0 };
  }

  return {
    teamA_PL: result.teamA_PL ?? 0,
    teamB_PL: result.teamB_PL ?? 0,
  };
}

export function calculateSnapshotBook(snapshot: Pick<Parameters<typeof mapRecord>[0], 'teamA' | 'teamB'>): IBookResult {
  return calculateNetBook([mapRecord(snapshot)]);
}

export function addBookResults(base: IBookResult | null | undefined, delta: IBookResult): IBookResult {
  return {
    teamA_PL: (base?.teamA_PL ?? 0) + delta.teamA_PL,
    teamB_PL: (base?.teamB_PL ?? 0) + delta.teamB_PL,
  };
}

export async function calculateMatchBookInTimeRange(
  matchId: string,
  startTime: Date,
  endTime: Date = new Date()
): Promise<IBookResult> {
  const [result] = await OddsSnapshot.aggregate<IBookResult & { _id: null }>([
    {
      $match: {
        matchId,
        capturedAt: { $gte: startTime, $lte: endTime }
      }
    },
    {
      $group: {
        _id: null,
        teamA_PL: {
          $sum: {
            $add: [
              {
                $multiply: [
                  { $subtract: [{ $arrayElemAt: ['$teamA.odds', 0] }, 1] },
                  { $arrayElemAt: ['$teamA.pricing', 0] },
                ],
              },
              {
                $multiply: [
                  -1,
                  { $subtract: [{ $arrayElemAt: ['$teamA.odds', 1] }, 1] },
                  { $arrayElemAt: ['$teamA.pricing', 1] },
                ],
              },
              { $multiply: [-1, { $arrayElemAt: ['$teamB.pricing', 0] }] },
              { $arrayElemAt: ['$teamB.pricing', 1] },
            ],
          },
        },
        teamB_PL: {
          $sum: {
            $add: [
              { $multiply: [-1, { $arrayElemAt: ['$teamA.pricing', 0] }] },
              { $arrayElemAt: ['$teamA.pricing', 1] },
              {
                $multiply: [
                  { $subtract: [{ $arrayElemAt: ['$teamB.odds', 0] }, 1] },
                  { $arrayElemAt: ['$teamB.pricing', 0] },
                ],
              },
              {
                $multiply: [
                  -1,
                  { $subtract: [{ $arrayElemAt: ['$teamB.odds', 1] }, 1] },
                  { $arrayElemAt: ['$teamB.pricing', 1] },
                ],
              },
            ],
          },
        },
      },
    },
  ]).exec();

  if (!result) {
    return { teamA_PL: 0, teamB_PL: 0 };
  }

  return {
    teamA_PL: result.teamA_PL ?? 0,
    teamB_PL: result.teamB_PL ?? 0,
  };
}

/**
 * Calculates the historical high and low of the running cumulative P/L
 * for each team across all snapshots in chronological order.
 *
 * We fetch all snapshots, compute each one's individual P/L contribution,
 * accumulate a running total, and track the peak/trough.
 */
export async function calculateMatchBookHighLow(matchId: string): Promise<IBookHighLow> {
  const snapshots = await OddsSnapshot.find({ matchId })
    .sort({ capturedAt: 1 })
    .select({ teamA: 1, teamB: 1 })
    .lean();

  let runA = 0;
  let runB = 0;
  let highA = 0;
  let lowA = 0;
  let highB = 0;
  let lowB = 0;

  for (const snap of snapshots) {
    const delta = calculateNetBook([mapRecord(snap)]);
    runA += delta.teamA_PL;
    runB += delta.teamB_PL;

    if (runA > highA) highA = runA;
    if (runA < lowA) lowA = runA;
    if (runB > highB) highB = runB;
    if (runB < lowB) lowB = runB;
  }

  return {
    teamA_high: highA,
    teamA_low: lowA,
    teamB_high: highB,
    teamB_low: lowB,
  };
}
