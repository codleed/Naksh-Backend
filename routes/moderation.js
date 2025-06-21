const express = require('express');
const router = express.Router();

// GET /api/moderation/flags - Get moderation flags with pagination and filters
router.get('/flags', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'PENDING',
      entityType,
      reporterId 
    } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(entityType && { entityType }),
      ...(reporterId && { reporterId })
    };

    const flags = await req.prisma.moderationFlag.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        reporter: {
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

    // Fetch additional entity details based on entityType
    const enrichedFlags = await Promise.all(
      flags.map(async (flag) => {
        let entityDetails = null;
        
        try {
          switch (flag.entityType) {
            case 'POST':
              entityDetails = await req.prisma.post.findUnique({
                where: { id: flag.entityId },
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
              });
              break;
            case 'COMMENT':
              entityDetails = await req.prisma.comment.findUnique({
                where: { id: flag.entityId },
                select: {
                  id: true,
                  body: true,
                  createdAt: true,
                  author: {
                    select: {
                      id: true,
                      username: true,
                      displayName: true
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
              break;
            case 'USER':
              entityDetails = await req.prisma.user.findUnique({
                where: { id: flag.entityId },
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  bio: true,
                  createdAt: true
                }
              });
              break;
          }
        } catch (error) {
          console.error(`Error fetching ${flag.entityType} details:`, error);
        }

        return {
          ...flag,
          entityDetails
        };
      })
    );

    const total = await req.prisma.moderationFlag.count({ where });

    res.json({
      flags: enrichedFlags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching moderation flags:', error);
    res.status(500).json({ error: 'Failed to fetch moderation flags' });
  }
});

// GET /api/moderation/flags/:id - Get moderation flag by ID
router.get('/flags/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const flag = await req.prisma.moderationFlag.findUnique({
      where: { id },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!flag) {
      return res.status(404).json({ error: 'Moderation flag not found' });
    }

    // Fetch entity details
    let entityDetails = null;
    try {
      switch (flag.entityType) {
        case 'POST':
          entityDetails = await req.prisma.post.findUnique({
            where: { id: flag.entityId },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true
                }
              },
              media: true,
              _count: {
                select: {
                  reactions: true,
                  comments: true
                }
              }
            }
          });
          break;
        case 'COMMENT':
          entityDetails = await req.prisma.comment.findUnique({
            where: { id: flag.entityId },
            include: {
              author: {
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
            }
          });
          break;
        case 'USER':
          entityDetails = await req.prisma.user.findUnique({
            where: { id: flag.entityId },
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              createdAt: true,
              suspendedUntil: true,
              _count: {
                select: {
                  posts: true,
                  comments: true,
                  followers: true,
                  following: true
                }
              }
            }
          });
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${flag.entityType} details:`, error);
    }

    res.json({
      ...flag,
      entityDetails
    });
  } catch (error) {
    console.error('Error fetching moderation flag:', error);
    res.status(500).json({ error: 'Failed to fetch moderation flag' });
  }
});

// POST /api/moderation/flags - Create new moderation flag
router.post('/flags', async (req, res) => {
  try {
    const { entityType, entityId, reporterId, reason } = req.body;

    if (!entityType || !entityId || !reporterId) {
      return res.status(400).json({ 
        error: 'Entity type, entity ID, and reporter ID are required' 
      });
    }

    // Validate entity type
    const validEntityTypes = ['POST', 'COMMENT', 'USER'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ 
        error: 'Invalid entity type. Must be one of: ' + validEntityTypes.join(', ')
      });
    }

    // Check if entity exists
    let entityExists = false;
    try {
      switch (entityType) {
        case 'POST':
          entityExists = !!(await req.prisma.post.findUnique({
            where: { id: entityId },
            select: { id: true }
          }));
          break;
        case 'COMMENT':
          entityExists = !!(await req.prisma.comment.findUnique({
            where: { id: entityId },
            select: { id: true }
          }));
          break;
        case 'USER':
          entityExists = !!(await req.prisma.user.findUnique({
            where: { id: entityId },
            select: { id: true }
          }));
          break;
      }
    } catch (error) {
      console.error('Error checking entity existence:', error);
    }

    if (!entityExists) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // Check if reporter exists
    const reporter = await req.prisma.user.findUnique({
      where: { id: reporterId },
      select: { id: true }
    });

    if (!reporter) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    // Check if user has already reported this entity
    const existingFlag = await req.prisma.moderationFlag.findFirst({
      where: {
        entityType,
        entityId,
        reporterId
      }
    });

    if (existingFlag) {
      return res.status(409).json({ error: 'You have already reported this content' });
    }

    const flag = await req.prisma.moderationFlag.create({
      data: {
        entityType,
        entityId,
        reporterId,
        reason
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json(flag);
  } catch (error) {
    console.error('Error creating moderation flag:', error);
    res.status(500).json({ error: 'Failed to create moderation flag' });
  }
});

// PUT /api/moderation/flags/:id/status - Update moderation flag status
router.put('/flags/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, moderatorId } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Validate status
    const validStatuses = ['PENDING', 'VALID', 'INVALID'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const flag = await req.prisma.moderationFlag.update({
      where: { id },
      data: { status },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    // If flag is marked as VALID, you might want to take action on the entity
    // This is a placeholder for additional moderation actions
    if (status === 'VALID') {
      // TODO: Implement automatic actions based on entity type
      // e.g., hide post, suspend user, etc.
    }

    res.json(flag);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Moderation flag not found' });
    }
    console.error('Error updating moderation flag status:', error);
    res.status(500).json({ error: 'Failed to update moderation flag status' });
  }
});

// GET /api/moderation/stats - Get moderation statistics
router.get('/stats', async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;

    // Calculate time threshold
    const timeThreshold = new Date();
    switch (timeframe) {
      case '24h':
        timeThreshold.setHours(timeThreshold.getHours() - 24);
        break;
      case '7d':
        timeThreshold.setDate(timeThreshold.getDate() - 7);
        break;
      case '30d':
        timeThreshold.setDate(timeThreshold.getDate() - 30);
        break;
      default:
        timeThreshold.setDate(timeThreshold.getDate() - 7);
    }

    const [
      totalFlags,
      pendingFlags,
      validFlags,
      invalidFlags,
      recentFlags,
      flagsByEntityType
    ] = await Promise.all([
      req.prisma.moderationFlag.count(),
      req.prisma.moderationFlag.count({ where: { status: 'PENDING' } }),
      req.prisma.moderationFlag.count({ where: { status: 'VALID' } }),
      req.prisma.moderationFlag.count({ where: { status: 'INVALID' } }),
      req.prisma.moderationFlag.count({
        where: { createdAt: { gte: timeThreshold } }
      }),
      req.prisma.moderationFlag.groupBy({
        by: ['entityType'],
        _count: { entityType: true },
        where: { createdAt: { gte: timeThreshold } }
      })
    ]);

    const stats = {
      total: totalFlags,
      pending: pendingFlags,
      valid: validFlags,
      invalid: invalidFlags,
      recent: recentFlags,
      byEntityType: flagsByEntityType.reduce((acc, item) => {
        acc[item.entityType] = item._count.entityType;
        return acc;
      }, {}),
      timeframe
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    res.status(500).json({ error: 'Failed to fetch moderation stats' });
  }
});

// GET /api/moderation/entity/:entityType/:entityId/flags - Get flags for specific entity
router.get('/entity/:entityType/:entityId/flags', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const flags = await req.prisma.moderationFlag.findMany({
      where: {
        entityType: entityType.toUpperCase(),
        entityId
      },
      include: {
        reporter: {
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

    res.json(flags);
  } catch (error) {
    console.error('Error fetching entity flags:', error);
    res.status(500).json({ error: 'Failed to fetch entity flags' });
  }
});

// DELETE /api/moderation/flags/:id - Delete moderation flag
router.delete('/flags/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.moderationFlag.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Moderation flag not found' });
    }
    console.error('Error deleting moderation flag:', error);
    res.status(500).json({ error: 'Failed to delete moderation flag' });
  }
});

module.exports = router;