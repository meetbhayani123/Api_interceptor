import type { Request, Response } from 'express';
import { Match } from '../models/Match.js';
import { OddsSnapshot } from '../models/OddsSnapshot.js';
import { OddsService } from '../services/OddsService.js';
import { calculateMatchBook } from '../services/BookService.js';
import { isPolling } from '../services/PollingService.js';
import { config } from '../config/env.js';

const SNAPSHOT_WINDOW_SIZE = 30;

const oddsService = new OddsService();

/** POST /api/match/import — Import matches from event IDs */
export async function importMatches(req: Request, res: Response) {
  try {
    let rawIds = req.body.eventIds || req.body.eventId;
    if (!rawIds) {
      return res.status(400).json({ error: 'eventIds is required' });
    }

    // Normalize input: accept array or comma/newline-separated string
    let ids: string[] = [];
    if (Array.isArray(rawIds)) {
      ids = rawIds;
    } else if (typeof rawIds === 'string') {
      ids = rawIds.split(/[\s,]+/).filter(Boolean);
    }

    if (ids.length === 0) {
      return res.status(400).json({ error: 'No valid event IDs found' });
    }

    const imported: any[] = [];
    const errors: any[] = [];

    for (const eventId of ids) {
      try {
        const details = await oddsService.getEventDetails(eventId);
        const name = `${details.team1} vs ${details.team2}`;

        const match = await Match.findOneAndUpdate(
          { eventId },
          {
            $set: {
              marketId: details.marketId,
              name,
              teamA: details.team1,
              teamB: details.team2,
            },
            $setOnInsert: {
              startTime: new Date(),
              status: 'upcoming',
              oddsHistory: [],
            },
          },
          { new: true, upsert: true }
        );

        imported.push(match);
      } catch (err: any) {
        errors.push({ id: eventId, message: err.message || 'Failed to import' });
      }
    }

    res.json({
      message: `Finished importing. Success: ${imported.length}, Failed: ${errors.length}`,
      matches: imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[MatchController] Import error:', error);
    res.status(500).json({ error: error.message || 'Internal error handling import' });
  }
}

/** POST /api/match/import-details — Upsert a match from already-fetched event details */
export async function importMatchDetails(req: Request, res: Response) {
  try {
    const { eventId, marketId, team1, team2, name, startTime } = req.body ?? {};

    if (!eventId || !marketId || !team1 || !team2) {
      return res.status(400).json({
        error: 'eventId, marketId, team1, and team2 are required',
      });
    }

    const matchName = name || `${team1} vs ${team2}`;

    const match = await Match.findOneAndUpdate(
      { eventId },
      {
        $set: {
          marketId,
          name: matchName,
          teamA: team1,
          teamB: team2,
          ...(startTime ? { startTime: new Date(startTime) } : {}),
        },
        $setOnInsert: {
          startTime: startTime ? new Date(startTime) : new Date(),
          status: 'upcoming',
          oddsHistory: [],
        },
      },
      { new: true, upsert: true }
    );

    res.json({
      message: 'Match saved successfully',
      match,
    });
  } catch (error: any) {
    console.error('[MatchController] Import details error:', error);
    res.status(500).json({ error: error.message || 'Failed to import match details' });
  }
}

/** GET /api/matches — List all matches */
export async function listMatches(_req: Request, res: Response) {
  try {
    const matches = await Match.find().sort({ createdAt: -1 });
    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
}

/** GET /api/match/:id — Get single match with snapshots + book */
export async function getMatch(req: Request, res: Response) {
  try {
    const match = await Match.findById(req.params.id).lean();
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const [totalSnapshotCount, latestSnapshotsDesc, finalBook] = await Promise.all([
      OddsSnapshot.countDocuments({ matchId: req.params.id }),
      OddsSnapshot.find({ matchId: req.params.id })
        .sort({ capturedAt: -1 })
        .limit(SNAPSHOT_WINDOW_SIZE)
        .lean(),
      calculateMatchBook(req.params.id),
    ]);

    // Keep payload chronological for consumers that assume oldest -> newest ordering.
    const snapshots = latestSnapshotsDesc.reverse();

    res.json({ ...match, snapshots, totalSnapshotCount, finalBook });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch match' });
  }
}

/** DELETE /api/match/:id — Delete match with password protection */
export async function deleteMatch(req: Request, res: Response) {
  try {
    const matchId = req.params.id;
    const { password } = req.body;

    if (!password || password !== config.deletePassword) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password' });
    }

    if (isPolling(matchId)) {
      return res.status(400).json({
        error: 'Cannot delete: Polling is still running. Stop it first.',
      });
    }

    await OddsSnapshot.deleteMany({ matchId });
    await Match.findByIdAndDelete(matchId);

    res.json({ message: 'Match and all snapshots deleted successfully.' });
  } catch (error: any) {
    console.error('[MatchController] Delete error:', error);
    res.status(500).json({ error: 'Internal server error while deleting.' });
  }
}

/** POST /api/match/:id/lock — Lock a book entry */
export async function lockBook(req: Request, res: Response) {
  try {
    const matchId = req.params.id;
    const { currentOdds } = req.body;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    match.oddsHistory.push({
      timestamp: new Date(),
      teamA: currentOdds.teamA,
      teamB: currentOdds.teamB,
      locked: true,
    });

    await match.save();

    const finalBook = await calculateMatchBook(matchId);

    res.json({
      message: 'Book locked successfully',
      finalBook,
      match,
    });
  } catch (error) {
    console.error('[MatchController] Lock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
