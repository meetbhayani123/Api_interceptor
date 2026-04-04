import { calculateNetBook, mapRecord } from '@repo/utils';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import type { IBookResult } from '@repo/types';

/**
 * Calculates the final book P/L for a given match from all its snapshots.
 * This is a thin orchestration layer — the actual math lives in @repo/utils.
 */
export async function calculateMatchBook(matchId: string): Promise<IBookResult> {
  const docs = await OddsSnapshot
    .find({ matchId })
    .sort({ capturedAt: 1 })
    .select({ teamA: 1, teamB: 1 })
    .lean();

  const records = docs.map(mapRecord);
  return calculateNetBook(records);
}
