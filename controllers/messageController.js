/**
 * Message Controller
 * Handles all messaging and chat-related operations
 */

/**
 * Get messages for a specific chat
 * GET /api/chats/:chatId/messages
 */
const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50, before, after } = req.query;
    const userId = req.user?.id;
    const skip = (page - 1) * limit;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is a member of the chat
    const chatMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId
        }
      }
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    // Build where clause for pagination
    const where = {
      chatId,
      ...(before && { createdAt: { lt: new Date(before) } }),
      ...(after && { createdAt: { gt: new Date(after) } })
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
            avatarUrl: true,
            isAnonymous: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.message.count({ where: { chatId } });

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

/**
 * Send a message to a chat
 * POST /api/chats/:chatId/messages
 */
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { body } = req.body;
    const senderId = req.user?.id;

    if (!senderId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    if (body.length > 1000) {
      return res.status(400).json({ error: 'Message body cannot exceed 1000 characters' });
    }

    // Check if user is a member of the chat
    const chatMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: senderId,
          chatId
        }
      }
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Not authorized to send messages to this chat' });
    }

    // Create message and update chat's lastMessageAt in a transaction
    const result = await req.prisma.$transaction(async (prisma) => {
      const message = await prisma.message.create({
        data: {
          body: body.trim(),
          senderId,
          chatId
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isAnonymous: true
            }
          },
          chat: {
            select: {
              id: true,
              isGroup: true,
              title: true
            }
          }
        }
      });

      // Update chat's lastMessageAt
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastMessageAt: message.createdAt }
      });

      return message;
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

/**
 * Get message by ID
 * GET /api/messages/:id
 */
const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const message = await req.prisma.message.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        },
        chat: {
          select: {
            id: true,
            isGroup: true,
            title: true,
            members: {
              select: {
                memberId: true
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a member of the chat
    const isMember = message.chat.members.some(member => member.memberId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized to access this message' });
    }

    res.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
};

/**
 * Mark message as delivered
 * PUT /api/messages/:id/delivered
 */
const markMessageAsDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if message exists and user has access
    const message = await req.prisma.message.findUnique({
      where: { id },
      include: {
        chat: {
          select: {
            members: {
              select: {
                memberId: true
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a member of the chat
    const isMember = message.chat.members.some(member => member.memberId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized to access this message' });
    }

    // Don't mark own messages as delivered
    if (message.senderId === userId) {
      return res.status(400).json({ error: 'Cannot mark own message as delivered' });
    }

    const updatedMessage = await req.prisma.message.update({
      where: { id },
      data: { deliveredAt: new Date() },
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
    });

    res.json({
      message: 'Message marked as delivered',
      data: updatedMessage
    });
  } catch (error) {
    console.error('Error marking message as delivered:', error);
    res.status(500).json({ error: 'Failed to mark message as delivered' });
  }
};

/**
 * Mark message as read
 * PUT /api/messages/:id/read
 */
const markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if message exists and user has access
    const message = await req.prisma.message.findUnique({
      where: { id },
      include: {
        chat: {
          select: {
            members: {
              select: {
                memberId: true
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a member of the chat
    const isMember = message.chat.members.some(member => member.memberId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized to access this message' });
    }

    // Don't mark own messages as read
    if (message.senderId === userId) {
      return res.status(400).json({ error: 'Cannot mark own message as read' });
    }

    const now = new Date();
    const updatedMessage = await req.prisma.message.update({
      where: { id },
      data: { 
        readAt: now,
        deliveredAt: message.deliveredAt || now // Mark as delivered if not already
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
    });

    res.json({
      message: 'Message marked as read',
      data: updatedMessage
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
};

/**
 * Mark all messages in a chat as read
 * PUT /api/chats/:chatId/messages/read-all
 */
const markAllMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is a member of the chat
    const chatMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId
        }
      }
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
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
        deliveredAt: now // Also mark as delivered if not already
      }
    });

    res.json({
      message: `Marked ${result.count} messages as read`,
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error marking all messages as read:', error);
    res.status(500).json({ error: 'Failed to mark all messages as read' });
  }
};

/**
 * Get unread message count for a chat
 * GET /api/chats/:chatId/messages/unread-count
 */
const getUnreadMessageCount = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is a member of the chat
    const chatMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId
        }
      }
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    const unreadCount = await req.prisma.message.count({
      where: {
        chatId,
        senderId: { not: userId },
        readAt: null
      }
    });

    res.json({
      chatId,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    res.status(500).json({ error: 'Failed to fetch unread message count' });
  }
};

/**
 * Get user's total unread message count across all chats
 * GET /api/messages/unread-count
 */
const getTotalUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all chats the user is a member of
    const userChats = await req.prisma.chatMember.findMany({
      where: { memberId: userId },
      select: { chatId: true }
    });

    const chatIds = userChats.map(chat => chat.chatId);

    if (chatIds.length === 0) {
      return res.json({ totalUnreadCount: 0, chatCounts: [] });
    }

    // Get unread count for each chat
    const chatCounts = await Promise.all(
      chatIds.map(async (chatId) => {
        const count = await req.prisma.message.count({
          where: {
            chatId,
            senderId: { not: userId },
            readAt: null
          }
        });
        return { chatId, unreadCount: count };
      })
    );

    const totalUnreadCount = chatCounts.reduce((sum, chat) => sum + chat.unreadCount, 0);

    res.json({
      totalUnreadCount,
      chatCounts: chatCounts.filter(chat => chat.unreadCount > 0)
    });
  } catch (error) {
    console.error('Error fetching total unread message count:', error);
    res.status(500).json({ error: 'Failed to fetch total unread message count' });
  }
};

/**
 * Search messages in a chat
 * GET /api/chats/:chatId/messages/search
 */
const searchChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { query, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;
    const skip = (page - 1) * limit;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Check if user is a member of the chat
    const chatMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId
        }
      }
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    const where = {
      chatId,
      body: {
        contains: query.trim(),
        mode: 'insensitive'
      }
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
            avatarUrl: true,
            isAnonymous: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.message.count({ where });

    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      searchQuery: query
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
};

/**
 * Get message delivery status for a specific message
 * GET /api/messages/:id/status
 */
const getMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const message = await req.prisma.message.findUnique({
      where: { id },
      include: {
        chat: {
          select: {
            id: true,
            isGroup: true,
            members: {
              select: {
                memberId: true,
                member: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can check message status
    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Not authorized to check this message status' });
    }

    const recipients = message.chat.members
      .filter(member => member.memberId !== userId)
      .map(member => member.member);

    res.json({
      messageId: id,
      sentAt: message.createdAt,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      isDelivered: !!message.deliveredAt,
      isRead: !!message.readAt,
      recipients,
      recipientCount: recipients.length
    });
  } catch (error) {
    console.error('Error fetching message status:', error);
    res.status(500).json({ error: 'Failed to fetch message status' });
  }
};

module.exports = {
  getChatMessages,
  sendMessage,
  getMessageById,
  markMessageAsDelivered,
  markMessageAsRead,
  markAllMessagesAsRead,
  getUnreadMessageCount,
  getTotalUnreadMessageCount,
  searchChatMessages,
  getMessageStatus
};