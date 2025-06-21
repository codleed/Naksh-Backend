const express = require('express');
const chatController = require('../controllers/chatController');
const router = express.Router();

// GET /api/chats - Get chats for a user
router.get('/', chatController.getUserChats);

// GET /api/chats/:id - Get chat by ID
router.get('/:id', chatController.getChatById);

// POST /api/chats - Create new chat
router.post('/', chatController.createChat);

// PUT /api/chats/:id - Update chat
router.put('/:id', chatController.updateChat);

// DELETE /api/chats/:id - Delete chat
router.delete('/:id', chatController.deleteChat);

// POST /api/chats/:id/members - Add member to chat
router.post('/:id/members', chatController.addChatMember);

// DELETE /api/chats/:id/members/:memberId - Remove member from chat
router.delete('/:id/members/:memberId', chatController.removeChatMember);

// GET /api/chats/:id/members - Get chat members
router.get('/:id/members', chatController.getChatMembers);

module.exports = router;