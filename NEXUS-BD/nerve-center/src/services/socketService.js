'use strict';

const { Server } = require('socket.io');
const logger = require('../config/logger');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Initialize Socket.io with the HTTP server.
 */
function init(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
      credentials: true
    }
  });

  // Authentication Middleware for Sockets
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
      if (!token) {
        logger.warn('Socket connection attempt without token', { socketId: socket.id });
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      logger.error('Socket authentication failed', { socketId: socket.id, error: err.message });
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    logger.info(`User connected to socket: ${userId}`, { socketId: socket.id });

    // Each user joins a private room based on their ID
    socket.join(`user:${userId}`);

    // Join a specific inquiry room for real-time chat
    socket.on('join_inquiry', async (inquiryId) => {
      try {
        const { query } = require('../config/db');
        const result = await query(
          'SELECT id FROM inquiries WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)',
          [inquiryId, userId]
        );
        
        if (result.rows.length > 0) {
          socket.join(`inquiry:${inquiryId}`);
          const roomSize = io.sockets.adapter.rooms.get(`inquiry:${inquiryId}`)?.size || 0;
          logger.info(`User ${userId} joined inquiry room: ${inquiryId}`, { roomSize });
        }
      } catch (err) {
        logger.error('Socket join_inquiry error', { error: err.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected from socket: ${userId}`);
    });
  });

  return io;
}

/**
 * Get the IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

/**
 * Emit an event to a specific user
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

module.exports = { init, getIO, emitToUser };
