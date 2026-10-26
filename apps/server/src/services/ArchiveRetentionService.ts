import { ArchivedMatch } from '../models/ArchivedMatch.js';
import { ArchivedFrame } from '../models/ArchivedFrame.js';
import { config } from '../config/env.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SWEEP_INTERVAL_MS = DAY_MS;

/** Archives are removed in chunks so one sweep never builds a huge $in list. */
const BATCH_SIZE = 100;

let sweepTimer: NodeJS.Timeout | null = null;

export interface PurgeResult {
  archivesDeleted: number;
  framesDeleted: number;
}

/** The moment before which an archive is considered expired. */
export function retentionCutoff(now: number = Date.now()): Date {
  return new Date(now - config.archiveRetentionDays * DAY_MS);
}

/**
 * Delete archives older than the retention window, with their frames.
 *
 * Keyed on `archivedAt` — when the record was made — and deliberately NOT a
 * MongoDB TTL index. A TTL on archived_frames would have to key on
 * `capturedAt`, which is when the odds were originally recorded, so archiving
 * an old match would see its frames expire immediately.
 */
export async function removeArchives(ids: unknown[]): Promise<PurgeResult> {
  if (ids.length === 0) return { archivesDeleted: 0, framesDeleted: 0 };

  // Frames first. Interrupted here, the archive still exists and a later sweep
  // or retry finishes the job. The other order would leave frames with no
  // archive pointing at them — invisible, and never collected, since every
  // query starts from archived_matches.
  const frames = await ArchivedFrame.deleteMany({ archiveId: { $in: ids } });
  const archives = await ArchivedMatch.deleteMany({ _id: { $in: ids } });

  return {
    archivesDeleted: archives.deletedCount ?? 0,
    framesDeleted: frames.deletedCount ?? 0,
  };
}

export async function purgeExpiredArchives(now: number = Date.now()): Promise<PurgeResult> {
  const cutoff = retentionCutoff(now);
  let archivesDeleted = 0;
  let framesDeleted = 0;

  // Loop rather than one pass, so a long outage with many expired archives
  // still clears fully.
  for (;;) {
    const expired = await ArchivedMatch.find({ archivedAt: { $lt: cutoff } })
      .select({ _id: 1, name: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (expired.length === 0) break;

    const removed = await removeArchives(expired.map((a) => a._id));

    framesDeleted += removed.framesDeleted;
    archivesDeleted += removed.archivesDeleted;

    for (const archive of expired) {
      console.log(`[ArchiveRetention] 🗑  Purged "${archive.name}" (archived before ${cutoff.toISOString()})`);
    }

    if (expired.length < BATCH_SIZE) break;
  }

  return { archivesDeleted, framesDeleted };
}

async function runSweep(): Promise<void> {
  try {
    const { archivesDeleted, framesDeleted } = await purgeExpiredArchives();
    if (archivesDeleted > 0) {
      console.log(
        `[ArchiveRetention] Removed ${archivesDeleted} archive(s) and ${framesDeleted} frame(s) ` +
        `older than ${config.archiveRetentionDays} days.`
      );
    }
  } catch (error) {
    // Never let a failed sweep take the process down; it retries tomorrow.
    console.error('[ArchiveRetention] Sweep failed:', error);
  }
}

/**
 * Start the retention job. Call once after MongoDB is connected.
 *
 * Runs immediately as well as on the interval, so a service that was asleep
 * catches up as soon as it wakes rather than waiting a full day.
 */
export function initArchiveRetention(intervalMs: number = DEFAULT_SWEEP_INTERVAL_MS): void {
  if (sweepTimer) {
    console.warn('[ArchiveRetention] Already running — skipping duplicate init.');
    return;
  }

  console.log(
    `[ArchiveRetention] ✓ Started — purging archives older than ` +
    `${config.archiveRetentionDays} days, every ${Math.round(intervalMs / 3_600_000)}h.`
  );

  runSweep();
  sweepTimer = setInterval(runSweep, intervalMs);
}

export function stopArchiveRetention(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  console.log('[ArchiveRetention] Stopped.');
}
