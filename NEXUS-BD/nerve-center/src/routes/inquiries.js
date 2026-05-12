'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/db');
const logger = require('../config/logger');
const { emitToUser } = require('../services/socketService');

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/inquiries
 * Create a new domain inquiry between a buyer and a verified seller.
 */
router.post(
  '/',
  [
    body('domain').isString().trim().notEmpty(),
    body('message').isString().trim().isLength({ min: 10 }),
    body('offer_price').optional().isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { domain, message, offer_price } = req.body;

    try {
      // Find the owner of the domain in the Nexus ecosystem
      const portfolioRes = await query(
        'SELECT user_id FROM portfolio WHERE domain = $1',
        [domain]
      );

      if (portfolioRes.rows.length === 0) {
        return res.status(404).json({ error: 'Domain owner not found in Nexus ecosystem.' });
      }

      const receiverId = portfolioRes.rows[0].user_id;
      if (receiverId === req.user.id) {
        return res.status(400).json({ error: 'You cannot inquire about your own domain.' });
      }

      const result = await query(
        `INSERT INTO inquiries (domain, sender_id, receiver_id, message, offer_price) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [domain, req.user.id, receiverId, message, offer_price || null]
      );

      const inquiry = result.rows[0];

      // Insert initial message into chat history
      await query(
        'INSERT INTO messages (inquiry_id, sender_id, content) VALUES ($1, $2, $3)',
        [inquiry.id, req.user.id, message]
      );
      
      // Notify the receiver in real-time
      emitToUser(receiverId, 'new_inquiry', {
        ...inquiry,
        sender_email: req.user.email
      });

      return res.status(201).json(inquiry);
    } catch (err) {
      logger.error('Failed to create inquiry', { error: err.message });
      return res.status(500).json({ error: 'Failed to send inquiry.' });
    }
  }
);

/**
 * GET /api/inquiries
 * List all authentic inquiries for the authenticated user.
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, 
              s.email as sender_email, 
              r.email as receiver_email 
       FROM inquiries i
       JOIN users s ON i.sender_id = s.id
       JOIN users r ON i.receiver_id = r.id
       WHERE i.sender_id = $1 OR i.receiver_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch inquiries.' });
  }
});

/**
 * GET /api/inquiries/:id/messages
 * Fetch chat history for a specific inquiry.
 */
router.get('/:id/messages', async (req, res) => {
  try {
    // Verify user is part of this inquiry
    const authCheck = await query(
      'SELECT id FROM inquiries WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)',
      [req.params.id, req.user.id]
    );

    if (authCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to view this chat.' });
    }

    const result = await query(
      `SELECT m.*, u.email as sender_email 
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.inquiry_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );

    return res.json(result.rows);
  } catch (err) {
    logger.error('Failed to fetch messages', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

/**
 * POST /api/inquiries/:id/messages
 * Send a new chat message in a thread.
 */
router.post(
  '/:id/messages',
  [body('content').isString().trim().notEmpty()],
  async (req, res) => {
    const { content } = req.body;
    const inquiryId = req.params.id;

    try {
      // 1. Verify membership and get the other party
      const inquiryRes = await query(
        'SELECT sender_id, receiver_id, domain FROM inquiries WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)',
        [inquiryId, req.user.id]
      );

      if (inquiryRes.rows.length === 0) {
        return res.status(403).json({ error: 'Unauthorized to post in this chat.' });
      }

      const inquiry = inquiryRes.rows[0];
      const otherPartyId = inquiry.sender_id === req.user.id ? inquiry.receiver_id : inquiry.sender_id;

      // 2. Insert message
      const result = await query(
        'INSERT INTO messages (inquiry_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
        [inquiryId, req.user.id, content]
      );

      const message = {
        ...result.rows[0],
        sender_email: req.user.email
      };

      // 3. Broadcast to the other party
      // We broadcast to the inquiry room AND specifically to the other user's private room 
      // in case they are not in the chat UI but are logged in.
      const { getIO } = require('../services/socketService');
      const io = getIO();
      
      // Emit to inquiry-specific room
      io.to(`inquiry:${inquiryId}`).emit('new_message', message);
      
      // Also emit a general notification to the other user
      emitToUser(otherPartyId, 'chat_notification', {
        inquiry_id: inquiryId,
        domain: inquiry.domain,
        message: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      });

      return res.status(201).json(message);
    } catch (err) {
      logger.error('Failed to send message', { error: err.message });
      return res.status(500).json({ error: 'Failed to send message.' });
    }
  }
);

/**
 * PATCH /api/inquiries/:id
 * Update inquiry status (Accept/Decline/Negotiate).
 */
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Only open and closed are allowed.' });
  }
  try {
    const result = await query(
      "UPDATE inquiries SET status = $1, updated_at = NOW() WHERE id = $2 AND (sender_id = $3 OR receiver_id = $3) RETURNING *",
      [status, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found.' });
    
    const inquiry = result.rows[0];
    
    // Notify the OTHER party in the negotiation
    const otherPartyId = inquiry.sender_id === req.user.id ? inquiry.receiver_id : inquiry.sender_id;
    emitToUser(otherPartyId, 'inquiry_updated', inquiry);

    // Also broadcast status change to the inquiry room
    const { getIO } = require('../services/socketService');
    const io = getIO();
    io.to(`inquiry:${inquiry.id}`).emit('status_updated', inquiry);

    return res.json(inquiry);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update inquiry.' });
  }
});

module.exports = router;
