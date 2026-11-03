import { Match } from '../models/Match.js';
import { recordBook } from './SavedBookService.js';
import { config } from '../config/env.js';

const MINUTE_MS = 60_000;

/**
 * How late the checkpoint may fire and still be recorded.
 *
 * Timers are precise and the sweep runs every 30s, so this only matters after
 * a restart or outage. Saving the running total an hour late and tagging it
 * "10 min" would misreport it, so past this the checkpoint is abandoned rather
 * than written wrong.
 */
const GRACE_MS = 2 * MINUTE_MS;

/** When a match's book checkpoint is due. */
export function checkpointDueAt(startTime: Date): number {
  return startTime.getTime() + config.checkpointMinutes * MINUTE_MS;
}

/** The tag shown against the saved book, e.g. "10 min". */
export function checkpointLabel(): string {
  return `${config.checkpointMinutes} min`;
}

/**
 * Record the scheduled book checkpoint for a match, once.
 *
 * The figure saved is the running total at this moment — every frame captured
 * since polling began, including the pre-start lead — not a book formed only
 * during these minutes.
 *
 * Returns true if this call is the one that recorded it.
 */
export async function recordCheckpoint(matchId: string): Promise<boolean> {
  // Claim it conditionally. A timer and the periodic sweep can both reach the
  // same match; only the call that sets the marker goes on to write a book.
  const claimed = await Match.findOneAndUpdate(
    { _id: matchId, checkpointSavedAt: { $exists: false } },
    { $set: { checkpointSavedAt: new Date() } }
  )
    .select({ name: 1, startTime: 1, totalSnapshotCount: 1 })
    .lean();

  if (!claimed) return false;

  // Too late to be honest about. The marker stays set so this is not retried
  // every sweep for the rest of the match.
  const lateBy = Date.now() - checkpointDueAt(claimed.startTime);
  if (lateBy > GRACE_MS) {
    console.warn(
      `[BookCheckpoint] Skipped "${claimed.name}" — ${checkpointLabel()} mark passed ` +
      `${Math.round(lateBy / MINUTE_MS)}m ago, too late to record it as the ${checkpointLabel()} book.`
    );
    return false;
  }

  // Nothing captured means there is no book to speak of; recording 0/0 would
  // just be noise in the history.
  if ((claimed.totalSnapshotCount ?? 0) === 0) {
    console.log(`[BookCheckpoint] Skipped "${claimed.name}" — no frames captured by the ${checkpointLabel()} mark.`);
    return false;
  }

  const label = checkpointLabel();

  try {
    await recordBook(matchId, {
      trigger: 'checkpoint',
      label,
      reason: `Automatic save ${label} after start`,
    });
    console.log(`[BookCheckpoint] 💾 Saved the ${label} book for "${claimed.name}"`);
    return true;
  } catch (error) {
    // Release the claim so a later sweep can try again.
    await Match.findByIdAndUpdate(matchId, { $unset: { checkpointSavedAt: '' } });
    console.error(`[BookCheckpoint] Could not save the ${label} book for ${matchId}:`, error);
    return false;
  }
}
