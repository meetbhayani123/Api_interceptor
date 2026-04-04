import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { config } from '../config/env.js';

let io: Server;

/**
 * Initialize Socket.IO server and attach event handlers.
 */
export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join_match', (matchId: string) => {
      socket.join(matchId);
    });

    socket.on('leave_match', (matchId: string) => {
      socket.leave(matchId);
    });
  });

  return io;
}

/**
 * Get the active Socket.IO server instance.
 */
export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocketServer first.');
  return io;
}
