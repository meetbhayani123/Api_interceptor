import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/env.js';
import { initSocketServer } from './socket/index.js';
import eventRoutes from './routes/event.routes.js';
import matchRoutes from './routes/match.routes.js';
import pollingRoutes from './routes/polling.routes.js';
// ─── Express App ───
const app = express();
app.use(cors({
    origin: function (origin, callback) {
        // dynamically allow any origin 
        callback(null, true);
    },
    credentials: true
}));
app.use(express.json());
// ─── Health Check (used by Render + UptimeRobot to keep the service alive) ───
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─── Routes ───
app.use('/api', eventRoutes);
app.use('/api', matchRoutes);
app.use('/api', pollingRoutes);
// ─── HTTP + Socket.IO ───
const httpServer = createServer(app);
initSocketServer(httpServer);
// ─── Start ───
mongoose
    .connect(config.mongoUri)
    .then(async () => {
    console.log('✓ Connected to MongoDB');
    // Drop stale `matchId_1` unique index if it exists.
    // This index was left over from an earlier schema version and causes
    // E11000 duplicate-key errors when inserting new matches.
    try {
        const matchesCollection = mongoose.connection.db.collection('matches');
        const indexes = await matchesCollection.indexes();
        const staleIndex = indexes.find((idx) => idx.name === 'matchId_1');
        if (staleIndex) {
            await matchesCollection.dropIndex('matchId_1');
            console.log('✓ Dropped stale matchId_1 index from matches collection');
        }
    }
    catch (indexErr) {
        // Non-fatal: log and continue
        console.warn('⚠ Could not clean up stale index:', indexErr.message);
    }
    httpServer.listen(config.port, () => {
        console.log(`✓ Server listening on port ${config.port}`);
    });
})
    .catch((error) => {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
});
