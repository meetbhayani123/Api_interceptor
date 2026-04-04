import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { calculateNetBook, mapRecord } from '@repo/utils';
import { Match } from './models/Match.js';
import { OddsSnapshot } from './models/OddsSnapshot.js';
import crypto from 'crypto';
import { OddsService } from './services/OddsService.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

let deletePassword = process.env.DELETE_PASSWORD || 'admin123';
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
  const match = envContent.match(/^DELETE_PASSWORD=(.*)$/m);
  if (match) deletePassword = match[1].trim();
} catch (e) {}

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const oddsService = new OddsService();
const activePolls = new Map<string, NodeJS.Timeout>();

io.on('connection', (socket) => {
  socket.on('join_match', (matchId) => {
    socket.join(matchId);
  });
  socket.on('leave_match', (matchId) => {
    socket.leave(matchId);
  });
});

// Frontend API endpoint querying the cURL service bypassing simple request detection
app.get('/api/event/:eventId', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const details = await oddsService.getEventDetails(eventId);
    res.json(details);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to fetch event details' });
  }
});

// Follow up querying API linking Function A output to Function B
app.get('/api/market/:marketId', async (req, res) => {
  try {
    const marketId = req.params.marketId;
    const odds = await oddsService.getMarketOdds(marketId);
    res.json(odds);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to fetch market odds' });
  }
});

// Endpoint to import and store a match from eventIds
app.post('/api/match/import', async (req, res) => {
  try {
    let rawIds = req.body.eventIds || req.body.eventId;
    if (!rawIds) {
      return res.status(400).json({ error: 'eventIds is required' });
    }

    // Support both an array of strings or a comma/newline separated string
    let ids: string[] = [];
    if (Array.isArray(rawIds)) {
      ids = rawIds;
    } else if (typeof rawIds === 'string') {
      ids = rawIds.split(/[\s,]+/).filter(Boolean);
    }

    if (ids.length === 0) {
      return res.status(400).json({ error: 'No valid event IDs found' });
    }

    const importedMatches = [];
    const errors = [];

    // Loop through and import each
    for (const eventId of ids) {
      try {
        const details = await oddsService.getEventDetails(eventId);

        // Upsert the match: update if exists, insert if new
        const name = `${details.team1} vs ${details.team2}`;
        const match = await Match.findOneAndUpdate(
          { eventId }, // Query
          {
            $set: {
              marketId: details.marketId,
              name: name,
              teamA: details.team1,
              teamB: details.team2
            },
            $setOnInsert: {
              startTime: new Date(), // Set only when creating a completely new match
              status: 'upcoming',
              oddsHistory: []
            }
          },
          { new: true, upsert: true } // Return updated doc, create if missing
        );

        importedMatches.push(match);
      } catch (err: any) {
        errors.push({ id: eventId, message: err.message || 'Failed to import' });
      }
    }

    res.json({
      message: `Finished importing. Success: ${importedMatches.length}, Failed: ${errors.length}`,
      matches: importedMatches,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error importing match:', error);
    res.status(500).json({ error: error.message || 'Internal error handling import' });
  }
});

// Endpoint to get all matches sorted newest first
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await Match.find().sort({ createdAt: -1 });
    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Endpoint to get a single match by database ID
app.get('/api/match/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id).lean();
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const snapshots = await OddsSnapshot.find({ matchId: req.params.id }).sort({ capturedAt: 1 });
    const records = snapshots.map(mapRecord);
    const finalBook = calculateNetBook(records);

    res.json({ ...match, snapshots, finalBook });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// Helper for polling
const executePoll = async (matchId: string) => {
  const match = await Match.findById(matchId);
  if (!match || !match.marketId) return;

  try {
    const { teamA, teamB } = await oddsService.getSnapshotData(match.marketId);
    const latestSnapshot = await OddsSnapshot.findOne({ matchId }).sort({ capturedAt: -1 });

    let isDifferent = true;
    if (latestSnapshot) {
      const isTeamASame = latestSnapshot.teamA
        && JSON.stringify(latestSnapshot.teamA.odds) === JSON.stringify(teamA.odds)
        && JSON.stringify(latestSnapshot.teamA.pricing) === JSON.stringify(teamA.pricing);
      const isTeamBSame = latestSnapshot.teamB
        && JSON.stringify(latestSnapshot.teamB.odds) === JSON.stringify(teamB.odds)
        && JSON.stringify(latestSnapshot.teamB.pricing) === JSON.stringify(teamB.pricing);

      if (isTeamASame && isTeamBSame) {
        isDifferent = false;
      }
    }

    if (!isDifferent) {
      return; // Skip saving
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
      teamB
    });

    await snapshot.save();
    
    const docs = await OddsSnapshot.find({ matchId }).sort({ capturedAt: 1 }).select({ teamA: 1, teamB: 1 }).lean();
    const records = docs.map(mapRecord);
    const finalBook = calculateNetBook(records);

    // Emit to room
    io.to(matchId).emit('odds_update', { matchId, snapshot, finalBook });
  } catch (error) {
    console.error('Interval Poll Error for match', matchId, error);
  }
};

app.post('/api/match/:id/start-polling', async (req, res) => {
  const matchId = req.params.id;
  if (activePolls.has(matchId)) {
    return res.json({ message: 'Polling already active' });
  }
  
  await Match.findByIdAndUpdate(matchId, { status: 'running' });

  // Do one poll immediately
  await executePoll(matchId);

  const interval = setInterval(() => {
    executePoll(matchId);
  }, 3000); // 3 seconds continuously
  activePolls.set(matchId, interval);
  res.json({ message: 'Polling started' });
});

app.post('/api/match/:id/stop-polling', async (req, res) => {
  const matchId = req.params.id;
  if (activePolls.has(matchId)) {
    clearInterval(activePolls.get(matchId));
    activePolls.delete(matchId);
  }
  await Match.findByIdAndUpdate(matchId, { status: 'completed' });
  res.json({ message: 'Polling stopped' });
});

app.get('/api/match/:id/polling-status', (req, res) => {
  res.json({ isPolling: activePolls.has(req.params.id) });
});

// Endpoint to delete a match and its snapshots securely
app.delete('/api/match/:id', async (req, res) => {
  try {
    const matchId = req.params.id;
    const { password } = req.body;
    
    if (!password || password !== deletePassword) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password' });
    }

    if (activePolls.has(matchId)) {
      return res.status(400).json({ error: 'Cannot delete: Polling is still actively running for this match. Please stop it first.' });
    }

    // Attempt to delete DB records
    await OddsSnapshot.deleteMany({ matchId });
    await Match.findByIdAndDelete(matchId);

    // Provide success status
    res.json({ message: 'Match and all recorded snapshots deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting match:', error);
    res.status(500).json({ error: 'Internal server error while deleting.' });
  }
});

// Endpoint to "Lock" a book
app.post('/api/match/:id/lock', async (req, res) => {
  try {
    const matchId = req.params.id;
    const { currentOdds } = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    match.oddsHistory.push({
      timestamp: new Date(),
      teamA: currentOdds.teamA,
      teamB: currentOdds.teamB,
      locked: true
    });

    const docs = await OddsSnapshot.find({ matchId }).sort({ capturedAt: 1 }).select({ teamA: 1, teamB: 1 }).lean();
    const records = docs.map(mapRecord);
    const finalBookResult = calculateNetBook(records);

    await match.save();

    res.json({
      message: 'Book locked successfully',
      finalBook: finalBookResult,
      match: match
    });
  } catch (error) {
    console.error('Error locking book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/antigravity_db';

mongoose.connect(MONGO_URI).then(() => {
  console.log('Connected to MongoDB');
  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch((error) => {
  console.error('MongoDB connection error:', error);
});
