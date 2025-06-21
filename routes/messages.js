const express = require('express');
const router = express.Router();

// GET /api/messages - Get messages for a chat
router.get('/', async (req, res) => {
  try {
    const { 
      chatId, 
      userId, 
      page = 1, 
      limit = 50,
      before // For pagination - get messages before this message ID
    } = req.query;

    if (!chatId || !userId) {
      return res.status(400).json({ 
        error: 'Chat ID and user ID are required' 
      });
    }

    // Check if user is a member of this chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const skip = (page - 1) * limit;
    const where = {
      chatId,
      ...(before && {
        createdAt: {
          lt: (await req.prisma.message.findUnique({
            where: { id: before },
            select: { createdAt: true }
          }))?.createdAt
        }
      })
    };

    const messages = await req.prisma.message.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.message.count({ 
      where: { chatId } 
    });

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messages/:id - Get message by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const message = await req.prisma.message.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        chat: {
          select: {
            id: true,
            title: true,
            isGroup: true
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a member of the chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId: message.chatId
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// POST /api/messages - Send new message
router.post('/', async (req, res) => {
  try {
    const { senderId, chatId, body } = req.body;

    if (!senderId || !chatId || !body) {
      return res.status(400).json({ 
        error: 'Sender ID, chat ID, and body are required' 
      });
    }

    // Check if sender is a member of the chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: senderId,
          chatId
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message and update chat's lastMessageAt
    const [message] = await req.prisma.$transaction([
      req.prisma.message.create({
        data: {
          senderId,
          chatId,
          body
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true
            }
          }
        }
      }),
      req.prisma.chat.update({
        where: { id: chatId },
        data: { lastMessageAt: new Date() }
      })
    ]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/messages/:id/delivered - Mark message as delivered
router.put('/:id/delivered', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get message to check chat membership
    const message = await req.prisma.message.findUnique({
      where: { id },
      select: { chatId: true, senderId: true, deliveredAt: true }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a member of the chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId: message.chatId
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't update if already delivered or if user is the sender
    if (message.deliveredAt || message.senderId === userId) {
      return res.json({ message: 'Message already delivered or user is sender' });
    }

    const updatedMessage = await req.prisma.message.update({
      where: { id },
      data: { deliveredAt: new Date() },
      select: {
        id: true,
        deliveredAt: true
      }
    });

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error marking message as delivered:', error);
    res.status(500).json({ error: 'Failed to mark message as delivered' });
  }
});

// PUT /api/messages/:id/read - Mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get message to check chat membership
    const message = await req.prisma.message.findUnique({
      where: { id },
      select: { chatId: true, senderId: true, readAt: true, deliveredAt: true }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a member of the chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId: message.chatId
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't update if already read or if user is the sender
    if (message.readAt || message.senderId === userId) {
      return res.json({ message: 'Message already read or user is sender' });
    }

    const now = new Date();
    const updatedMessage = await req.prisma.message.update({
      where: { id },
      data: { 
        readAt: now,
        // Also mark as delivered if not already
        ...(message.deliveredAt ? {} : { deliveredAt: now })
      },
      select: {
        id: true,
        deliveredAt: true,
        readAt: true
      }
    });

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// PUT /api/messages/chat/:chatId/read-all - Mark all messages in chat as read
router.put('/chat/:chatId/read-all', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user is a member of the chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date();
    
    // Mark all unread messages as read (excluding user's own messages)
    const result = await req.prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        readAt: null
      },
      data: {
        readAt: now,
        deliveredAt: now // Also ensure delivered
      }
    });

    res.json({ 
      message: 'Messages marked as read',
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// GET /api/messages/chat/:chatId/unread-count - Get unread message count for a chat
router.get('/chat/:chatId/unread-count', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user is a member of the chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const unreadCount = await req.prisma.message.count({
      where: {
        chatId,
        senderId: { not: userId },
        readAt: null
      }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// GET /api/messages/user/:userId/unread-total - Get total unread message count for user
router.get('/user/:userId/unread-total', async (req, res) => {
  try {
    const { userId } = req.params;

    const unreadCount = await req.prisma.message.count({
      where: {
        senderId: { not: userId },
        readAt: null,
        chat: {
          members: {
            some: { memberId: userId }
          }
        }
      }
    });

    res.json({ totalUnreadCount: unreadCount });
  } catch (error) {
    console.error('Error fetching total unread count:', error);
    res.status(500).json({ error: 'Failed to fetch total unread count' });
  }
});

// DELETE /api/messages/:id - Delete message (soft delete by setting body to empty)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const message = await req.prisma.message.findUnique({
      where: { id },
      select: { senderId: true, chatId: true }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can delete their message
    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    await req.prisma.message.update({
      where: { id },
      data: { body: '[Message deleted]' }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;