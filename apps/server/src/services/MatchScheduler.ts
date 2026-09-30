import { Match } from '../models/Match.js';
import { startPolling, isPolling } from './PollingService.js';

/**
 * MatchScheduler — Automatically starts polling for matches ahead of their startTime.
 *
 * Polling begins `PRE_START_LEAD_MS` before a match's startTime, so odds are
 * already being captured by the time the match goes live.
 *
 * Two triggers:
 *   1. A periodic sweep every `checkIntervalMs` (default: 30s) that picks up
 *      matches as their lead window opens.
 *   2. `scheduleMatchById()`, called right after an import, so a match added
 *      when its window is already open starts polling immediately instead of
 *      waiting up to 30s for the next sweep.
 */

const DEFAULT_CHECK_INTERVAL_MS = 30_000; // 30 seconds

// Begin polling this far ahead of the match's startTime.
const PRE_START_LEAD_MS = 30 * 60_000; // 30 minutes

let schedulerInterval: NodeJS.Timeout | null = null;
let checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
const scheduledTimers = new Map<string, NodeJS.Timeout>();

interface SchedulableMatch {
  _id: any;
  name: string;
  startTime: Date;
}

/** The moment polling should begin for a match. */
export function pollingStartsAt(startTime: Date): number {
  return startTime.getTime() - PRE_START_LEAD_MS;
}

export type PollingDecision =
  | { action: 'start' }
  | { action: 'schedule'; delayMs: number };

/**
 * Decide what to do with a match right now: start polling immediately because
 * its lead window is already open, or wait until the window opens.
 *
 * Pure, so the timing boundaries can be tested without a database.
 */
export function decidePolling(startTime: Date, now: number): PollingDecision {
  const delayMs = pollingStartsAt(startTime) - now;
  return delayMs <= 0 ? { action: 'start' } : { action: 'schedule', delayMs };
}

function clearScheduledTimer(matchId: string): void {
  const existing = scheduledTimers.get(matchId);
  if (existing) {
    clearTimeout(existing);
    scheduledTimers.delete(matchId);
  }
}

/**
 * Start polling now if the match's lead window is already open,
 * otherwise arm a timer for the moment it opens.
 */
async function evaluateMatch(match: SchedulableMatch, now: number): Promise<void> {
  const matchId = match._id.toString();

  if (isPolling(matchId)) return;

  const decision = decidePolling(match.startTime, now);

  if (decision.action === 'start') {
    // Lead window already open (or startTime passed) — start right away.
    clearScheduledTimer(matchId);
    const minsToStart = Math.round((match.startTime.getTime() - now) / 60_000);
    console.log(
      `[MatchScheduler] ⏰ Auto-starting polling for "${match.name}" ` +
      (minsToStart > 0 ? `(starts in ${minsToStart}m)` : `(startTime already passed)`)
    );
    await startPolling(matchId);
    return;
  }

  // Already armed — leave the existing timer alone.
  if (scheduledTimers.has(matchId)) return;

  console.log(
    `[MatchScheduler] 📅 Scheduling "${match.name}" to start polling in ` +
    `${Math.round(decision.delayMs / 1000)}s ` +
    `(${PRE_START_LEAD_MS / 60_000}m before startTime)`
  );

  const timer = setTimeout(async () => {
    scheduledTimers.delete(matchId);
    if (!isPolling(matchId)) {
      console.log(`[MatchScheduler] ⏰ Auto-starting polling for "${match.name}" (scheduled timer fired)`);
      await startPolling(matchId);
    }
  }, decision.delayMs);

  scheduledTimers.set(matchId, timer);
}

/**
 * Periodic sweep: find every upcoming match whose lead window is open,
 * or opens before the next sweep, and start or schedule it.
 */
async function checkAndStartMatches(): Promise<void> {
  try {
    const now = new Date();
    // Look one sweep beyond the lead window so timers are armed slightly early
    // rather than being missed between sweeps.
    const horizon = new Date(now.getTime() + PRE_START_LEAD_MS + checkIntervalMs);

    const readyMatches = await Match.find({
      status: 'upcoming',
      startTime: { $lte: horizon },
    })
      .select({ _id: 1, name: 1, startTime: 1 })
      .lean();

    for (const match of readyMatches) {
      await evaluateMatch(match, now.getTime());
    }
  } catch (error) {
    console.error('[MatchScheduler] Error checking matches:', error);
  }
}

/**
 * Evaluate a single match immediately. Called right after an import so a match
 * added inside its lead window starts polling without waiting for the next sweep.
 *
 * Any existing timer is re-armed, since an import can change startTime.
 */
export async function scheduleMatchById(matchId: string): Promise<void> {
  try {
    const match = await Match.findById(matchId)
      .select({ _id: 1, name: 1, startTime: 1, status: 1 })
      .lean();

    if (!match || match.status !== 'upcoming') return;

    clearScheduledTimer(matchId);
    await evaluateMatch(match, Date.now());
  } catch (error) {
    console.error(`[MatchScheduler] Error scheduling match ${matchId}:`, error);
  }
}

/**
 * Initialize the scheduler. Call this once after MongoDB is connected.
 */
export function initMatchScheduler(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.warn('[MatchScheduler] Already running — skipping duplicate init.');
    return;
  }

  checkIntervalMs = intervalMs;

  console.log(
    `[MatchScheduler] ✓ Started — checking for upcoming matches every ${checkIntervalMs / 1000}s ` +
    `(polling starts ${PRE_START_LEAD_MS / 60_000}m before each match's startTime)`
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
