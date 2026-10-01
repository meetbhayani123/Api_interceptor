import crypto from 'crypto';
import { Match } from '../models/Match.js';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import { OddsService } from './OddsService.js';
import { addBookResults, calculateMatchBook, calculateSnapshotBook, calculateMatchBookInTimeRange, calculateMatchBookHighLow, advanceBookHighLow } from './BookService.js';
import { getIO } from '../socket/index.js';
import { config } from '../config/env.js';

const oddsService = new OddsService();
// A null value means a start is in flight: the slot is reserved but the timer
// does not exist yet. Reserving synchronously is what makes startPolling safe
// against concurrent callers.
const activePolls = new Map<string, NodeJS.Timeout | null>();
const runningPolls = new Set<string>();

/**
 * Poll health, kept in memory so a successful-but-unchanged poll does not cost
 * a database write every 3 seconds. Successes are flushed on a throttle;
 * failures and recoveries are written immediately, because those are the
 * transitions anyone looking at the UI actually needs to see.
 */
interface PollHealth {
  lastSuccessAt: number;
  lastPersistedSuccessAt: number;
  consecutiveFailures: number;
}

const health = new Map<string, PollHealth>();
const HEALTH_PERSIST_INTERVAL_MS = 15_000;

function healthFor(matchId: string): PollHealth {
  let entry = health.get(matchId);
  if (!entry) {
    entry = { lastSuccessAt: 0, lastPersistedSuccessAt: 0, consecutiveFailures: 0 };
    health.set(matchId, entry);
  }
  return entry;
}

/**
 * A poll that returned parseable odds — whether or not they had changed.
 * Unchanged odds are a healthy feed, not a failure.
 */
async function recordPollSuccess(matchId: string): Promise<void> {
  const entry = healthFor(matchId);
  const now = Date.now();
  const recovered = entry.consecutiveFailures > 0;

  entry.lastSuccessAt = now;
  entry.consecutiveFailures = 0;

  // Always persist a recovery; otherwise only every HEALTH_PERSIST_INTERVAL_MS.
  if (!recovered && now - entry.lastPersistedSuccessAt < HEALTH_PERSIST_INTERVAL_MS) return;

  entry.lastPersistedSuccessAt = now;
  await Match.findByIdAndUpdate(matchId, {
    $set: { lastSuccessfulPollAt: new Date(now), consecutiveFailures: 0 },
    $unset: { lastPollError: '' },
  });
}

/**
 * A poll that threw. Persisted immediately, and after enough consecutive
 * failures the match is stopped rather than left retrying forever against a
 * feed that is not coming back.
 */
async function recordPollFailure(matchId: string, error: unknown): Promise<void> {
  const entry = healthFor(matchId);
  entry.consecutiveFailures += 1;

  const message = error instanceof Error ? error.message : String(error);

  await Match.findByIdAndUpdate(matchId, {
    $set: {
      consecutiveFailures: entry.consecutiveFailures,
      lastPollError: message.slice(0, 500),
    },
  });

  if (entry.consecutiveFailures < config.maxConsecutiveFailures) return;

  console.error(
    `[PollingService] ✖ Stopping match ${matchId} after ${entry.consecutiveFailures} ` +
    `consecutive failures. Last error: ${message}`
  );
  await stopPolling(matchId);
}

/**
 * Compares two team odds snapshots for equality.
 */
function isSnapshotIdentical(
  existing: { teamA: any; teamB: any },
  incoming: { teamA: any; teamB: any }
): boolean {
  const sameA =
    JSON.stringify(existing.teamA?.odds) === JSON.stringify(incoming.teamA.odds) &&
    JSON.stringify(existing.teamA?.pricing) === JSON.stringify(incoming.teamA.pricing);
  const sameB =
    JSON.stringify(existing.teamB?.odds) === JSON.stringify(incoming.teamB.odds) &&
    JSON.stringify(existing.teamB?.pricing) === JSON.stringify(incoming.teamB.pricing);
  return sameA && sameB;
}

/**
 * Execute a single poll cycle: fetch odds, deduplicate, save, emit via socket.
 */
async function executePoll(matchId: string): Promise<void> {
  if (runningPolls.has(matchId)) return;

  runningPolls.add(matchId);

  try {
    const match = await Match.findById(matchId)
      .select({ marketId: 1, finalBook: 1, bookHighLow: 1, totalSnapshotCount: 1 })
      .lean();

    if (!match?.marketId) return;

    const { teamA, teamB } = await oddsService.getSnapshotData(match.marketId);

    // The feed answered. Record that before the dedup check below, or a market
    // whose odds simply are not moving would look like a broken feed.
    await recordPollSuccess(matchId);

    const latestSnapshot = await OddsSnapshot.findOne({ matchId })
      .sort({ capturedAt: -1 })
      .select({ teamA: 1, teamB: 1, sequenceId: 1, capturedAt: 1 })
      .lean();

    // Skip if data hasn't changed
    if (latestSnapshot && isSnapshotIdentical(latestSnapshot, { teamA, teamB })) {
      return;
    }

    const payloadString = JSON.stringify({ teamA, teamB });
    const signature = crypto.createHash('sha256').update(payloadString).digest('hex');
    const sequenceId = latestSnapshot ? latestSnapshot.sequenceId + 1 : 1;

    const snapshot = new OddsSnapshot({
      matchId,
      sequenceId,
      signature,
      capturedAt: new Date(),
      teamA,
      teamB,
    });

    await snapshot.save();

    // Update the cached book so detail requests do not rescan every snapshot.
    const finalBook = match.finalBook
      ? addBookResults(match.finalBook, calculateSnapshotBook(snapshot))
      : await calculateMatchBook(matchId);

    // Extend the cached peak/trough from the new cumulative book. O(1) — only
    // matches with no cached value (imported before this was stored) pay for a
    // one-time history scan, after which this stays constant-time.
    const previousHighLow = match.bookHighLow ?? (await calculateMatchBookHighLow(matchId));
    const bookHighLow = advanceBookHighLow(previousHighLow, finalBook);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [rollingBook5m] = await Promise.all([
      calculateMatchBookInTimeRange(matchId, fiveMinutesAgo),
      Match.findByIdAndUpdate(matchId, {
        $set: {
          finalBook,
          bookHighLow,
          totalSnapshotCount: snapshot.sequenceId,
        },
      }),
    ]);

    getIO().to(matchId).emit('odds_update', {
      matchId,
      snapshot,
      finalBook,
      rollingBook5m,
      bookHighLow,
      totalSnapshotCount: snapshot.sequenceId,
      lastSuccessfulPollAt: new Date(),
      consecutiveFailures: 0,
    });
  } catch (error) {
    console.error(`[PollingService] Error for match ${matchId}:`, error);
    try {
      await recordPollFailure(matchId, error);
    } catch (healthError) {
      console.error(`[PollingService] Could not record failure for ${matchId}:`, healthError);
    }
  } finally {
    runningPolls.delete(matchId);
  }
}

/**
 * Start continuous polling for a match.
 */
export async function startPolling(matchId: string): Promise<boolean> {
  if (activePolls.has(matchId)) return false; // Already active or starting

  // Claim the slot BEFORE awaiting anything. The scheduler sweep, the HTTP
  // route and the post-import hook can all target the same match at once, and
  // the first poll below may spend 10s+ retrying against the external API.
  // Recording ourselves only after that left a window in which every caller
  // passed the guard and created its own interval — and since the map holds
  // just one, the rest polled forever and could never be cleared.
  activePolls.set(matchId, null);

  try {
    // Immediate first poll
    await executePoll(matchId);

    // stopPolling may have run while that was in flight. A stop wins.
    if (!activePolls.has(matchId)) return false;

    const interval = setInterval(() => {
      executePoll(matchId);
    }, config.pollingIntervalMs);

    activePolls.set(matchId, interval);

    await Match.findByIdAndUpdate(matchId, { status: 'running', pollingStartedAt: new Date() });
    return true;
  } catch (error) {
    // Never strand the reservation, or the match can never be started again.
    activePolls.delete(matchId);
    throw error;
  }
}

/**
 * Stop polling for a match.
 */
export async function stopPolling(matchId: string): Promise<void> {
  const interval = activePolls.get(matchId);
  if (interval) clearInterval(interval);

  // Delete even when the value is null, so a start still in flight is
  // cancelled rather than finishing and installing an interval behind us.
  activePolls.delete(matchId);
  health.delete(matchId);

  await Match.findByIdAndUpdate(matchId, { status: 'completed' });
}

/**
 * Check if a match is being polled.
 */
export function isPolling(matchId: string): boolean {
  return activePolls.has(matchId);
}

/** Match ids this process is currently polling. */
export function getActivePollIds(): string[] {
  return [...activePolls.keys()];
}
