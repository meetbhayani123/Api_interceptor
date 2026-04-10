import crypto from 'crypto';
import { Match } from '../models/Match.js';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import { OddsService } from './OddsService.js';
import { calculateMatchBook } from './BookService.js';
import { getIO } from '../socket/index.js';
import { config } from '../config/env.js';

const oddsService = new OddsService();
const activePolls = new Map<string, NodeJS.Timeout>();

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
  const match = await Match.findById(matchId);
  if (!match?.marketId) return;

  try {
    const { teamA, teamB } = await oddsService.getSnapshotData(match.marketId);
    const latestSnapshot = await OddsSnapshot.findOne({ matchId }).sort({ capturedAt: -1 });

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

    // Calculate updated book and emit to subscribers
    const finalBook = await calculateMatchBook(matchId);
    getIO().to(matchId).emit('odds_update', {
      matchId,
      snapshot,
      finalBook,
      totalSnapshotCount: snapshot.sequenceId,
    });
  } catch (error) {
    console.error(`[PollingService] Error for match ${matchId}:`, error);
  }
}

/**
 * Start continuous polling for a match.
 */
export async function startPolling(matchId: string): Promise<boolean> {
  if (activePolls.has(matchId)) return false; // Already active

  await Match.findByIdAndUpdate(matchId, { status: 'running' });

  // Immediate first poll
  await executePoll(matchId);

  const interval = setInterval(() => {
    executePoll(matchId);
  }, config.pollingIntervalMs);

  activePolls.set(matchId, interval);
  return true;
}

/**
 * Stop polling for a match.
 */
export async function stopPolling(matchId: string): Promise<void> {
  const interval = activePolls.get(matchId);
  if (interval) {
    clearInterval(interval);
    activePolls.delete(matchId);
  }
  await Match.findByIdAndUpdate(matchId, { status: 'completed' });
}

/**
 * Check if a match is being polled.
 */
export function isPolling(matchId: string): boolean {
  return activePolls.has(matchId);
}
