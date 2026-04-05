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
app.use(cors({ origin: config.cors.origin }));
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
    .then(() => {
    console.log('✓ Connected to MongoDB');
    httpServer.listen(config.port, () => {
        console.log(`✓ Server listening on port ${config.port}`);
    });
})
    .catch((error) => {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
});
