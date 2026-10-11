import { Match } from '../models/Match.js';
import { SavedBook } from '../models/SavedBook.js';
import { calculateMatchBook } from './BookService.js';
import type { ISavedBook, SavedBookTrigger } from '@repo/types';

interface RecordBookOptions {
  trigger?: SavedBookTrigger;
  /** Context for an automatic save, shown in the history. */
  reason?: string;
}

/**
 * Write the match's current full-history book as a permanent, timestamped row.
 *
 * Shared by the Save Book button and by the automatic save when a match ends,
 * so both produce identical records. The figures are always read here rather
 * than accepted from a caller — a saved book has to be trustworthy.
 *
 * Returns null when the match no longer exists.
 */
export async function recordBook(
  matchId: string,
  { trigger = 'manual', reason }: RecordBookOptions = {}
): Promise<ISavedBook | null> {
  const match = await Match.findById(matchId)
    .select({ name: 1, teamA: 1, teamB: 1, finalBook: 1, totalSnapshotCount: 1 })
    .lean();

  if (!match) return null;

  // Fall back to computing it, so a match whose cache was never written can
  // still be recorded.
  const book = match.finalBook ?? (await calculateMatchBook(matchId));

  const saved = await SavedBook.create({
    matchId,
    matchName: match.name,
    teamA: match.teamA ?? '',
    teamB: match.teamB ?? '',
    teamA_PL: book?.teamA_PL ?? 0,
    teamB_PL: book?.teamB_PL ?? 0,
    snapshotCount: match.totalSnapshotCount ?? 0,
    trigger,
    reason,
    savedAt: new Date(),
  });

  return saved.toObject() as unknown as ISavedBook;
}
