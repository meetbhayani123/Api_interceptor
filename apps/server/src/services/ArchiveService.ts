import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';

export interface ArchiveResult {
  archiveId: string;
  name: string;
  frameCount: number;
}

/**
 * Preserve a match and every frame it captured, before the originals are
 * deleted.
 *
 * Frames are copied with $merge so the work happens inside MongoDB — a long
 * match can hold tens of thousands of frames, and pulling those through Node
 * only to write them straight back would be slow and memory-hungry.
 *
 * Returns null when the match does not exist.
 */
export async function archiveMatch(matchId: string): Promise<ArchiveResult | null> {
  const match = await Match.findById(matchId).lean();
  if (!match) return null;

  // Frame bounds, for context on the archive listing.
  const [bounds] = await OddsSnapshot.aggregate<{ count: number; first: Date; last: Date }>([
    { $match: { matchId } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        first: { $min: '$capturedAt' },
        last: { $max: '$capturedAt' },
      },
    },
  ]).exec();

  const archive = await ArchivedMatch.create({
    originalMatchId: matchId,
    name: match.name,
    teamA: match.teamA ?? '',
    teamB: match.teamB ?? '',
    eventId: match.eventId,
    marketId: match.marketId,
    startTime: match.startTime,
    finalBook: match.finalBook,
    bookHighLow: (match as any).bookHighLow,
    frameCount: bounds?.count ?? 0,
    firstFrameAt: bounds?.first,
    lastFrameAt: bounds?.last,
    archivedAt: new Date(),
  });

  if ((bounds?.count ?? 0) > 0) {
    try {
      await OddsSnapshot.aggregate([
        { $match: { matchId } },
        {
          $project: {
            // Drop the original _id so every row inserts rather than colliding
            // with a previous archive of the same match.
            _id: 0,
            archiveId: { $literal: archive._id },
            originalMatchId: '$matchId',
            sequenceId: 1,
            capturedAt: 1,
            teamA: 1,
            teamB: 1,
          },
        },
        { $merge: { into: 'archived_frames', whenMatched: 'keepExisting', whenNotMatched: 'insert' } },
      ]).exec();
    } catch (error) {
      // Never leave an archive claiming frames it does not have.
      await ArchivedMatch.findByIdAndDelete(archive._id);
      await ArchivedFrame.deleteMany({ archiveId: archive._id });
      throw error;
    }

    // Trust the copy only if it actually landed.
    const copied = await ArchivedFrame.countDocuments({ archiveId: archive._id });
    if (copied !== bounds.count) {
      await ArchivedMatch.findByIdAndUpdate(archive._id, { $set: { frameCount: copied } });
      console.warn(
        `[ArchiveService] Archived ${copied}/${bounds.count} frames for "${match.name}". ` +
        `Count corrected on the archive.`
      );
    }
  }

  return {
    archiveId: (archive._id as mongoose.Types.ObjectId).toString(),
    name: match.name,
    frameCount: bounds?.count ?? 0,
  };
}
