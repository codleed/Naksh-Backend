const express = require('express');
const router = express.Router();

// GET /api/reactions - Get reactions with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      postId,
      userId,
      type 
    } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(postId && { postId }),
      ...(userId && { userId }),
      ...(type && { type })
    };

    const reactions = await req.prisma.reaction.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        post: {
          select: {
            id: true,
            caption: true,
            author: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.reaction.count({ where });

    res.json({
      reactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// POST /api/reactions - Add or update reaction
router.post('/', async (req, res) => {
  try {
    const { postId, userId, type } = req.body;

    if (!postId || !userId || !type) {
      return res.status(400).json({ 
        error: 'Post ID, user ID, and reaction type are required' 
      });
    }

    // Validate reaction type
    const validTypes = ['LIKE', 'LOL', 'SAD', 'LOVE', 'ANGRY', 'WOW'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid reaction type. Must be one of: ' + validTypes.join(', ')
      });
    }

    // Verify post exists and is not deleted
    const post = await req.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, deletedAt: true, expiresAt: true }
    });

    if (!post || post.deletedAt) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Cannot react to expired post' });
    }

    // Check if user already has a reaction on this post
    const existingReaction = await req.prisma.reaction.findFirst({
      where: { postId, userId }
    });

    let reaction;

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Same reaction type - remove it (toggle off)
        await req.prisma.reaction.delete({
          where: {
            postId_userId_type: {
              postId,
              userId,
              type
            }
          }
        });
        return res.json({ message: 'Reaction removed', removed: true });
      } else {
        // Different reaction type - delete old and create new
        await req.prisma.reaction.delete({
          where: {
            postId_userId_type: {
              postId: existingReaction.postId,
              userId: existingReaction.userId,
              type: existingReaction.type
            }
          }
        });
      }
    }

    // Create new reaction
    reaction = await req.prisma.reaction.create({
      data: {
        postId,
        userId,
        type
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        post: {
          select: {
            id: true,
            caption: true
          }
        }
      }
    });

    res.status(201).json(reaction);
  } catch (error) {
    console.error('Error creating reaction:', error);
    res.status(500).json({ error: 'Failed to create reaction' });
  }
});

// DELETE /api/reactions - Remove reaction
router.delete('/', async (req, res) => {
  try {
    const { postId, userId, type } = req.body;

    if (!postId || !userId || !type) {
      return res.status(400).json({ 
        error: 'Post ID, user ID, and reaction type are required' 
      });
    }

    await req.prisma.reaction.delete({
      where: {
        postId_userId_type: {
          postId,
          userId,
          type
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Reaction not found' });
    }
    console.error('Error deleting reaction:', error);
    res.status(500).json({ error: 'Failed to delete reaction' });
  }
});

// GET /api/reactions/post/:postId - Get reactions for a specific post
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { groupBy = false } = req.query;

    if (groupBy === 'true') {
      // Get reaction counts grouped by type
      const reactionCounts = await req.prisma.reaction.groupBy({
        by: ['type'],
        where: { postId },
        _count: {
          type: true
        }
      });

      // Get recent users for each reaction type (for display)
      const reactionDetails = await Promise.all(
        reactionCounts.map(async (count) => {
          const recentUsers = await req.prisma.reaction.findMany({
            where: { postId, type: count.type },
            take: 3,
            include: {
              user: {
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

          return {
            type: count.type,
            count: count._count.type,
            recentUsers: recentUsers.map(r => r.user)
          };
        })
      );

      res.json(reactionDetails);
    } else {
      // Get all reactions for the post
      const reactions = await req.prisma.reaction.findMany({
        where: { postId },
        include: {
          user: {
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

      res.json(reactions);
    }
  } catch (error) {
    console.error('Error fetching post reactions:', error);
    res.status(500).json({ error: 'Failed to fetch post reactions' });
  }
});

// GET /api/reactions/user/:userId - Get reactions by a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, type } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(type && { type })
    };

    const reactions = await req.prisma.reaction.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            },
            media: {
              take: 1,
              select: {
                mediaUrl: true,
                type: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.reaction.count({ where });

    res.json({
      reactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user reactions:', error);
    res.status(500).json({ error: 'Failed to fetch user reactions' });
  }
});

// GET /api/reactions/check - Check if user has reacted to a post
router.get('/check', async (req, res) => {
  try {
    const { postId, userId } = req.query;

    if (!postId || !userId) {
      return res.status(400).json({ 
        error: 'Post ID and user ID are required' 
      });
    }

    const reaction = await req.prisma.reaction.findFirst({
      where: { postId, userId },
      select: {
        type: true,
        createdAt: true
      }
    });

    res.json({
      hasReacted: !!reaction,
      reactionType: reaction?.type || null,
      reactedAt: reaction?.createdAt || null
    });
  } catch (error) {
    console.error('Error checking reaction:', error);
    res.status(500).json({ error: 'Failed to check reaction' });
  }
});

// GET /api/reactions/stats/:postId - Get reaction statistics for a post
router.get('/stats/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    const stats = await req.prisma.reaction.groupBy({
      by: ['type'],
      where: { postId },
      _count: {
        type: true
      }
    });

    const totalReactions = stats.reduce((sum, stat) => sum + stat._count.type, 0);

    const formattedStats = {
      total: totalReactions,
      breakdown: stats.reduce((acc, stat) => {
        acc[stat.type] = stat._count.type;
        return acc;
      }, {})
    };

    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching reaction stats:', error);
    res.status(500).json({ error: 'Failed to fetch reaction stats' });
  }
});

module.exports = router;