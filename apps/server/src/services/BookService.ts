import { calculateNetBook, mapRecord } from '@repo/utils';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import type { IBookResult } from '@repo/types';

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
