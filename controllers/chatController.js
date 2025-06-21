/**
 * Chat Controller
 * Handles all chat-related operations
 */

/**
 * Get chats for a user
 * GET /api/chats
 */
const getUserChats = async (req, res) => {
  try {
    const { userId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const chats = await req.prisma.chat.findMany({
      where: {
        members: {
          some: { memberId: userId }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        members: {
          include: {
            member: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: true,
            members: true
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    res.json({
      chats: chats.map(chat => ({
        ...chat,
        lastMessage: chat.messages[0] || null,
        messages: undefined // Remove messages array, keep only lastMessage
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: chats.length
      }
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
};

/**
 * Get chat by ID
 * GET /api/chats/:id
 */
const getChatById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const chat = await req.prisma.chat.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            member: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check if user is a member of this chat
    const isMember = chat.members.some(member => member.memberId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
};

/**
 * Create new chat
 * POST /api/chats
 */
const createChat = async (req, res) => {
  try {
    const { memberIds, isGroup = false, title } = req.body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ 
        error: 'At least 2 member IDs are required' 
      });
    }

    if (isGroup && !title) {
      return res.status(400).json({ 
        error: 'Title is required for group chats' 
      });
    }

    // For non-group chats, check if chat already exists between these users
    if (!isGroup && memberIds.length === 2) {
      const existingChat = await req.prisma.chat.findFirst({
        where: {
          isGroup: false,
          members: {
            every: {
              memberId: { in: memberIds }
            }
          }
        },
        include: {
          members: true
        }
      });

      if (existingChat && existingChat.members.length === 2) {
        return res.status(409).json({ 
          error: 'Chat already exists between these users',
          chatId: existingChat.id
        });
      }
    }

    // Verify all users exist
    const users = await req.prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true }
    });

    if (users.length !== memberIds.length) {
      return res.status(400).json({ error: 'One or more users not found' });
    }

    const chat = await req.prisma.chat.create({
      data: {
        isGroup,
        title,
        members: {
          create: memberIds.map(memberId => ({ memberId }))
        }
      },
      include: {
        members: {
          include: {
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
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
};

/**
 * Update chat
 * PUT /api/chats/:id
 */
const updateChat = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user is a member of this chat
    const chatMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId: id
        }
      }
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chat = await req.prisma.chat.update({
      where: { id },
      data: {
        ...(title !== undefined && { title })
      },
      include: {
        members: {
          include: {
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
    });

    res.json(chat);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Chat not found' });
    }
    console.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
};

/**
 * Delete chat
 * DELETE /api/chats/:id
 */
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user is a member of this chat
    const chatMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId: id
        }
      }
    });

    if (!chatMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await req.prisma.chat.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Chat not found' });
    }
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
};

/**
 * Add member to chat
 * POST /api/chats/:id/members
 */
const addChatMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId, addedBy } = req.body;

    if (!memberId || !addedBy) {
      return res.status(400).json({ 
        error: 'Member ID and added by user ID are required' 
      });
    }

    // Check if the user adding is a member of the chat
    const adderMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: addedBy,
          chatId: id
        }
      }
    });

    if (!adderMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if user is already a member
    const existingMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId,
          chatId: id
        }
      }
    });

    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    // Verify user exists
    const user = await req.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const member = await req.prisma.chatMember.create({
      data: {
        memberId,
        chatId: id
      },
      include: {
        member: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json(member);
  } catch (error) {
    console.error('Error adding chat member:', error);
    res.status(500).json({ error: 'Failed to add chat member' });
  }
};

/**
 * Remove member from chat
 * DELETE /api/chats/:id/members/:memberId
 */
const removeChatMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { removedBy } = req.body;

    if (!removedBy) {
      return res.status(400).json({ error: 'Removed by user ID is required' });
    }

    // Check if the user removing is a member of the chat or removing themselves
    if (removedBy !== memberId) {
      const removerMember = await req.prisma.chatMember.findUnique({
        where: {
          memberId_chatId: {
            memberId: removedBy,
            chatId: id
          }
        }
      });

      if (!removerMember) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    await req.prisma.chatMember.delete({
      where: {
        memberId_chatId: {
          memberId,
          chatId: id
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Chat member not found' });
    }
    console.error('Error removing chat member:', error);
    res.status(500).json({ error: 'Failed to remove chat member' });
  }
};

/**
 * Get chat members
 * GET /api/chats/:id/members
 */
const getChatMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user is a member of this chat
    const isMember = await req.prisma.chatMember.findUnique({
      where: {
        memberId_chatId: {
          memberId: userId,
          chatId: id
        }
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await req.prisma.chatMember.findMany({
      where: { chatId: id },
      include: {
        member: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true
          }
        }
      }
    });

    res.json(members.map(m => m.member));
  } catch (error) {
    console.error('Error fetching chat members:', error);
    res.status(500).json({ error: 'Failed to fetch chat members' });
  }
};

module.exports = {
  getUserChats,
  getChatById,
  createChat,
  updateChat,
  deleteChat,
  addChatMember,
  removeChatMember,
  getChatMembers
};