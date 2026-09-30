import { Match } from '../models/Match.js';
import { startPolling, stopPolling, isPolling } from './PollingService.js';
import { config } from '../config/env.js';

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

// A match is considered over this long after its startTime. Polling stops, and
// matches older than this are never auto-started (so importing last week's
// fixture does not kick off an endless poll).
const MAX_POLL_DURATION_MS = config.maxPollHours * 60 * 60_000;

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

/** The moment a match is treated as finished and polling is stopped. */
export function pollingExpiresAt(startTime: Date): number {
  return startTime.getTime() + MAX_POLL_DURATION_MS;
}

export type PollingDecision =
  | { action: 'start' }
  | { action: 'schedule'; delayMs: number }
  | { action: 'expired' };

/**
 * Decide what to do with a match right now: start polling immediately because
 * its lead window is already open, or wait until the window opens.
 *
 * Pure, so the timing boundaries can be tested without a database.
 */
export function decidePolling(startTime: Date, now: number): PollingDecision {
  // Long past its window: the match is over, so never (re)start it.
  if (now >= pollingExpiresAt(startTime)) return { action: 'expired' };

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

  if (decision.action === 'expired') {
    clearScheduledTimer(matchId);
    return;
  }

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
 * Stop matches whose polling window has elapsed.
 *
 * Nothing else ever stops polling — without this a started match runs until the
 * process dies. This also settles records left at 'running' by a crash, whether
 * or not this process happens to be polling them.
 */
async function stopFinishedMatches(now: Date): Promise<void> {
  const expiredBefore = new Date(now.getTime() - MAX_POLL_DURATION_MS);

  const finished = await Match.find({
    status: 'running',
    startTime: { $lt: expiredBefore },
  })
    .select({ _id: 1, name: 1 })
    .lean();

  for (const match of finished) {
    const matchId = match._id.toString();
    clearScheduledTimer(matchId);
    console.log(
      `[MatchScheduler] 🏁 Stopping "${match.name}" — more than ${config.maxPollHours}h past start.`
    );
    await stopPolling(matchId);
  }
}

/**
 * Periodic sweep.
 *
 * Covers three cases:
 *   - 'upcoming' matches whose lead window is open, or opens before the next sweep
 *   - 'running' matches this process is NOT polling, i.e. orphaned by a restart.
 *     activePolls lives in memory, so without this a restart would strand every
 *     in-flight match: no timer, and previously invisible to this query.
 *   - matches past their window, which get stopped.
 */
async function checkAndStartMatches(): Promise<void> {
  try {
    const now = new Date();

    await stopFinishedMatches(now);

    // Look one sweep beyond the lead window so timers are armed slightly early
    // rather than being missed between sweeps, and no further back than the
    // polling window, so old imports are not resurrected.
    const notBefore = new Date(now.getTime() - MAX_POLL_DURATION_MS);
    const notAfter = new Date(now.getTime() + PRE_START_LEAD_MS + checkIntervalMs);

    const candidates = await Match.find({
      status: { $in: ['upcoming', 'running'] },
      startTime: { $gte: notBefore, $lte: notAfter },
    })
      .select({ _id: 1, name: 1, startTime: 1, status: 1 })
      .lean();

    for (const match of candidates) {
      const matchId = match._id.toString();

      if (match.status === 'running' && !isPolling(matchId)) {
        console.log(`[MatchScheduler] ♻️  Resuming "${match.name}" — marked running but not polling (restart recovery).`);
      }

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

    if (!match || match.status === 'completed') return;

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
    `(polling starts ${PRE_START_LEAD_MS / 60_000}m before startTime, stops ${config.maxPollHours}h after)`
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
