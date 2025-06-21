/**
 * Reaction Controller
 * Handles all reaction-related operations
 */

/**
 * Get all reactions for a post with counts
 * GET /api/posts/:postId/reactions
 */
const getPostReactions = async (req, res) => {
  try {
    const { postId } = req.params;
    const { includeUsers = false } = req.query;

    // First check if post exists
    const post = await req.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get reaction counts grouped by type
    const reactionCounts = await req.prisma.reaction.groupBy({
      by: ['type'],
      where: { postId },
      _count: {
        type: true
      }
    });

    // Format reaction counts
    const reactions = {
      LIKE: 0,
      LOL: 0,
      SAD: 0,
      LOVE: 0,
      ANGRY: 0,
      WOW: 0
    };

    reactionCounts.forEach(reaction => {
      reactions[reaction.type] = reaction._count.type;
    });

    const response = {
      postId,
      reactions,
      total: Object.values(reactions).reduce((sum, count) => sum + count, 0)
    };

    // Include user details if requested
    if (includeUsers === 'true') {
      const reactionDetails = await req.prisma.reaction.findMany({
        where: { postId },
        include: {
          user: {
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

      response.reactionDetails = reactionDetails;
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching post reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
};

/**
 * Get reactions by type for a post
 * GET /api/posts/:postId/reactions/:type
 */
const getPostReactionsByType = async (req, res) => {
  try {
    const { postId, type } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Validate reaction type
    const validTypes = ['LIKE', 'LOL', 'SAD', 'LOVE', 'ANGRY', 'WOW'];
    if (!validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    // Check if post exists
    const post = await req.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const reactions = await req.prisma.reaction.findMany({
      where: {
        postId,
        type: type.toUpperCase()
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        user: {
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

    const total = await req.prisma.reaction.count({
      where: {
        postId,
        type: type.toUpperCase()
      }
    });

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
    console.error('Error fetching reactions by type:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
};

/**
 * Add or update a reaction to a post
 * POST /api/posts/:postId/reactions
 */
const addReaction = async (req, res) => {
  try {
    const { postId } = req.params;
    const { type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate reaction type
    const validTypes = ['LIKE', 'LOL', 'SAD', 'LOVE', 'ANGRY', 'WOW'];
    if (!type || !validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({ error: 'Valid reaction type is required' });
    }

    // Check if post exists
    const post = await req.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already has a reaction of this type on this post
    const existingReaction = await req.prisma.reaction.findUnique({
      where: {
        postId_userId_type: {
          postId,
          userId,
          type: type.toUpperCase()
        }
      }
    });

    if (existingReaction) {
      return res.status(409).json({ 
        error: 'Reaction already exists',
        message: 'User has already reacted with this type to this post'
      });
    }

    // Remove any existing reactions from this user on this post (users can only have one reaction per post)
    await req.prisma.reaction.deleteMany({
      where: {
        postId,
        userId
      }
    });

    // Create new reaction
    const reaction = await req.prisma.reaction.create({
      data: {
        postId,
        userId,
        type: type.toUpperCase()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        }
      }
    });

    res.status(201).json(reaction);
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
};

/**
 * Remove a reaction from a post
 * DELETE /api/posts/:postId/reactions
 */
const removeReaction = async (req, res) => {
  try {
    const { postId } = req.params;
    const { type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // If type is provided, remove specific reaction type
    if (type) {
      const validTypes = ['LIKE', 'LOL', 'SAD', 'LOVE', 'ANGRY', 'WOW'];
      if (!validTypes.includes(type.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid reaction type' });
      }

      const deletedReaction = await req.prisma.reaction.deleteMany({
        where: {
          postId,
          userId,
          type: type.toUpperCase()
        }
      });

      if (deletedReaction.count === 0) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
    } else {
      // Remove all reactions from this user on this post
      const deletedReactions = await req.prisma.reaction.deleteMany({
        where: {
          postId,
          userId
        }
      });

      if (deletedReactions.count === 0) {
        return res.status(404).json({ error: 'No reactions found' });
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
};

/**
 * Get user's reaction on a specific post
 * GET /api/posts/:postId/reactions/me
 */
const getUserReaction = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if post exists
    const post = await req.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const reaction = await req.prisma.reaction.findFirst({
      where: {
        postId,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        }
      }
    });

    if (!reaction) {
      return res.json({ hasReacted: false, reaction: null });
    }

    res.json({ hasReacted: true, reaction });
  } catch (error) {
    console.error('Error fetching user reaction:', error);
    res.status(500).json({ error: 'Failed to fetch user reaction' });
  }
};

/**
 * Get all reactions by a user
 * GET /api/users/:userId/reactions
 */
const getUserReactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const where = {
      userId,
      ...(type && { type: type.toUpperCase() })
    };

    // Validate reaction type if provided
    if (type) {
      const validTypes = ['LIKE', 'LOL', 'SAD', 'LOVE', 'ANGRY', 'WOW'];
      if (!validTypes.includes(type.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid reaction type' });
      }
    }

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
                displayName: true,
                avatarUrl: true
              }
            },
            media: {
              select: {
                id: true,
                mediaUrl: true,
                type: true
              },
              take: 1,
              orderBy: { ordering: 'asc' }
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
};

/**
 * Toggle reaction on a post (add if doesn't exist, remove if exists, or change type)
 * PUT /api/posts/:postId/reactions/toggle
 */
const toggleReaction = async (req, res) => {
  try {
    const { postId } = req.params;
    const { type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate reaction type
    const validTypes = ['LIKE', 'LOL', 'SAD', 'LOVE', 'ANGRY', 'WOW'];
    if (!type || !validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({ error: 'Valid reaction type is required' });
    }

    // Check if post exists
    const post = await req.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user already has any reaction on this post
    const existingReaction = await req.prisma.reaction.findFirst({
      where: {
        postId,
        userId
      }
    });

    if (existingReaction) {
      if (existingReaction.type === type.toUpperCase()) {
        // Same reaction type - remove it
        await req.prisma.reaction.delete({
          where: {
            postId_userId_type: {
              postId,
              userId,
              type: type.toUpperCase()
            }
          }
        });

        return res.json({ 
          action: 'removed',
          message: 'Reaction removed successfully'
        });
      } else {
        // Different reaction type - update it
        const updatedReaction = await req.prisma.reaction.update({
          where: {
            postId_userId_type: {
              postId: existingReaction.postId,
              userId: existingReaction.userId,
              type: existingReaction.type
            }
          },
          data: {
            type: type.toUpperCase(),
            createdAt: new Date() // Update timestamp for new reaction
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isAnonymous: true
              }
            }
          }
        });

        return res.json({
          action: 'updated',
          reaction: updatedReaction,
          message: 'Reaction updated successfully'
        });
      }
    } else {
      // No existing reaction - create new one
      const newReaction = await req.prisma.reaction.create({
        data: {
          postId,
          userId,
          type: type.toUpperCase()
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isAnonymous: true
            }
          }
        }
      });

      return res.status(201).json({
        action: 'created',
        reaction: newReaction,
        message: 'Reaction added successfully'
      });
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
};

/**
 * Get reaction statistics for multiple posts
 * POST /api/reactions/stats
 */
const getReactionStats = async (req, res) => {
  try {
    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ error: 'Array of post IDs is required' });
    }

    if (postIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 post IDs allowed' });
    }

    const reactionStats = await req.prisma.reaction.groupBy({
      by: ['postId', 'type'],
      where: {
        postId: {
          in: postIds
        }
      },
      _count: {
        type: true
      }
    });

    // Format the response
    const stats = {};
    postIds.forEach(postId => {
      stats[postId] = {
        LIKE: 0,
        LOL: 0,
        SAD: 0,
        LOVE: 0,
        ANGRY: 0,
        WOW: 0,
        total: 0
      };
    });

    reactionStats.forEach(stat => {
      if (stats[stat.postId]) {
        stats[stat.postId][stat.type] = stat._count.type;
        stats[stat.postId].total += stat._count.type;
      }
    });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching reaction stats:', error);
    res.status(500).json({ error: 'Failed to fetch reaction statistics' });
  }
};

module.exports = {
  getPostReactions,
  getPostReactionsByType,
  addReaction,
  removeReaction,
  getUserReaction,
  getUserReactions,
  toggleReaction,
  getReactionStats
};