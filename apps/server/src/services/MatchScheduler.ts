import { Match } from '../models/Match.js';
import { startPolling, isPolling } from './PollingService.js';

/**
 * MatchScheduler — Automatically starts polling for matches
 * whose startTime has arrived (or passed) and are still in 'upcoming' status.
 *
 * Runs a check every `checkIntervalMs` (default: 30 seconds).
 * Also schedules precise timers for matches whose startTime is within the
 * next check window, so polling begins exactly on time rather than up to
 * 30s late.
 */

const DEFAULT_CHECK_INTERVAL_MS = 30_000; // 30 seconds
// Start polling a bit early (60s before match time) to warm up connections
const EARLY_START_BUFFER_MS = 60_000;

let schedulerInterval: NodeJS.Timeout | null = null;
const scheduledTimers = new Map<string, NodeJS.Timeout>();

/**
 * Check for upcoming matches whose startTime has arrived and start polling.
 */
async function checkAndStartMatches(): Promise<void> {
  try {
    const now = new Date();
    // Find matches that are 'upcoming' and whose startTime is at or before now + buffer
    const readyMatches = await Match.find({
      status: 'upcoming',
      startTime: { $lte: new Date(now.getTime() + EARLY_START_BUFFER_MS) },
    })
      .select({ _id: 1, name: 1, startTime: 1, eventId: 1 })
      .lean();

    for (const match of readyMatches) {
      const matchId = match._id.toString();

      // Skip if already polling or already has a scheduled timer
      if (isPolling(matchId) || scheduledTimers.has(matchId)) {
        continue;
      }

      const msUntilStart = match.startTime.getTime() - now.getTime();

      if (msUntilStart <= 0) {
        // Match time has already passed — start immediately
        console.log(`[MatchScheduler] ⏰ Auto-starting polling for "${match.name}" (startTime already passed)`);
        await startPolling(matchId);
      } else {
        // Match is within the buffer window but hasn't started yet — schedule a precise timer
        console.log(
          `[MatchScheduler] 📅 Scheduling "${match.name}" to start polling in ${Math.round(msUntilStart / 1000)}s`
        );
        const timer = setTimeout(async () => {
          scheduledTimers.delete(matchId);
          if (!isPolling(matchId)) {
            console.log(`[MatchScheduler] ⏰ Auto-starting polling for "${match.name}" (scheduled timer fired)`);
            await startPolling(matchId);
          }
        }, msUntilStart);

        scheduledTimers.set(matchId, timer);
      }
    }
  } catch (error) {
    console.error('[MatchScheduler] Error checking matches:', error);
  }
}

/**
 * Initialize the scheduler. Call this once after MongoDB is connected.
 */
export function initMatchScheduler(checkIntervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.warn('[MatchScheduler] Already running — skipping duplicate init.');
    return;
  }

  console.log(
    `[MatchScheduler] ✓ Started — checking for upcoming matches every ${checkIntervalMs / 1000}s ` +
    `(early start buffer: ${EARLY_START_BUFFER_MS / 1000}s)`
  );

  // Run immediately on startup, then repeat at the interval
  checkAndStartMatches();
  schedulerInterval = setInterval(checkAndStartMatches, checkIntervalMs);
}

/**
 * Stop the scheduler and clear all pending timers.
 */
export function stopMatchScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  for (const [matchId, timer] of scheduledTimers) {
    clearTimeout(timer);
    scheduledTimers.delete(matchId);
  }

  console.log('[MatchScheduler] Stopped.');
}
