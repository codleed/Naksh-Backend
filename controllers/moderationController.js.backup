/**
 * Moderation Controller
 * Handles content moderation, reporting, and administrative actions
 */

/**
 * Report content (post, comment, or user)
 * POST /api/moderation/report
 */
const reportContent = async (req, res) => {
  try {
    const { entityType, entityId, reason } = req.body;
    const reporterId = req.user?.id;

    if (!reporterId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate entity type
    const validEntityTypes = ['POST', 'COMMENT', 'USER'];
    if (!entityType || !validEntityTypes.includes(entityType.toUpperCase())) {
      return res.status(400).json({ error: 'Valid entity type is required (POST, COMMENT, USER)' });
    }

    if (!entityId) {
      return res.status(400).json({ error: 'Entity ID is required' });
    }

    // Verify the entity exists based on type
    let entityExists = false;
    let entityData = null;

    switch (entityType.toUpperCase()) {
      case 'POST':
        entityData = await req.prisma.post.findUnique({
          where: { id: entityId, deletedAt: null },
          select: { id: true, authorId: true, caption: true }
        });
        entityExists = !!entityData;
        break;
      case 'COMMENT':
        entityData = await req.prisma.comment.findUnique({
          where: { id: entityId, deletedAt: null },
          select: { id: true, authorId: true, body: true }
        });
        entityExists = !!entityData;
        break;
      case 'USER':
        entityData = await req.prisma.user.findUnique({
          where: { id: entityId },
          select: { id: true, username: true, displayName: true }
        });
        entityExists = !!entityData;
        break;
    }

    if (!entityExists) {
      return res.status(404).json({ error: `${entityType.toLowerCase()} not found` });
    }

    // Check if user has already reported this entity
    const existingReport = await req.prisma.moderationFlag.findFirst({
      where: {
        entityType: entityType.toUpperCase(),
        entityId,
        reporterId
      }
    });

    if (existingReport) {
      return res.status(409).json({ 
        error: 'Already reported',
        message: 'You have already reported this content'
      });
    }

    // Prevent users from reporting their own content
    if (entityData && entityData.authorId === reporterId) {
      return res.status(400).json({ error: 'Cannot report your own content' });
    }

    // Create moderation flag
    const moderationFlag = await req.prisma.moderationFlag.create({
      data: {
        entityType: entityType.toUpperCase(),
        entityId,
        reporterId,
        reason: reason?.trim() || null,
        status: 'PENDING'
      },
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

    res.status(201).json({
      message: 'Content reported successfully',
      report: moderationFlag
    });
  } catch (error) {
    console.error('Error reporting content:', error);
    res.status(500).json({ error: 'Failed to report content' });
  }
};

/**
 * Get all moderation flags (admin only)
 * GET /api/moderation/flags
 */
const getModerationFlags = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      entityType, 
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};
    
    if (status) {
      const validStatuses = ['PENDING', 'VALID', 'INVALID'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      where.status = status.toUpperCase();
    }

    if (entityType) {
      const validEntityTypes = ['POST', 'COMMENT', 'USER'];
      if (!validEntityTypes.includes(entityType.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }
      where.entityType = entityType.toUpperCase();
    }

    // Build order by clause
    const validSortFields = ['createdAt', 'status', 'entityType'];
    const validSortOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy) || !validSortOrders.includes(sortOrder.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid sort parameters' });
    }

    const orderBy = { [sortBy]: sortOrder.toLowerCase() };

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
      orderBy
    });

    // Enrich flags with entity data
    const enrichedFlags = await Promise.all(flags.map(async (flag) => {
      let entityData = null;
      
      try {
        switch (flag.entityType) {
          case 'POST':
            entityData = await req.prisma.post.findUnique({
              where: { id: flag.entityId },
              select: {
                id: true,
                caption: true,
                createdAt: true,
                deletedAt: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true
                  }
                }
              }
            });
            break;
          case 'COMMENT':
            entityData = await req.prisma.comment.findUnique({
              where: { id: flag.entityId },
              select: {
                id: true,
                body: true,
                createdAt: true,
                deletedAt: true,
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true
                  }
                }
              }
            });
            break;
          case 'USER':
            entityData = await req.prisma.user.findUnique({
              where: { id: flag.entityId },
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                suspendedUntil: true,
                createdAt: true
              }
            });
            break;
        }
      } catch (err) {
        console.warn(`Failed to fetch entity data for ${flag.entityType} ${flag.entityId}:`, err);
      }

      return {
        ...flag,
        entityData
      };
    }));

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
};

/**
 * Get moderation flag by ID (admin only)
 * GET /api/moderation/flags/:id
 */
const getModerationFlagById = async (req, res) => {
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
            avatarUrl: true,
            createdAt: true
          }
        }
      }
    });

    if (!flag) {
      return res.status(404).json({ error: 'Moderation flag not found' });
    }

    // Get entity data
    let entityData = null;
    try {
      switch (flag.entityType) {
        case 'POST':
          entityData = await req.prisma.post.findUnique({
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
              media: {
                select: {
                  id: true,
                  mediaUrl: true,
                  type: true
                }
              }
            }
          });
          break;
        case 'COMMENT':
          entityData = await req.prisma.comment.findUnique({
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
                  caption: true
                }
              }
            }
          });
          break;
        case 'USER':
          entityData = await req.prisma.user.findUnique({
            where: { id: flag.entityId },
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              suspendedUntil: true,
              createdAt: true,
              _count: {
                select: {
                  posts: true,
                  comments: true,
                  moderationFlags: true
                }
              }
            }
          });
          break;
      }
    } catch (err) {
      console.warn(`Failed to fetch entity data for ${flag.entityType} ${flag.entityId}:`, err);
    }

    res.json({
      ...flag,
      entityData
    });
  } catch (error) {
    console.error('Error fetching moderation flag:', error);
    res.status(500).json({ error: 'Failed to fetch moderation flag' });
  }
};

/**
 * Update moderation flag status (admin only)
 * PUT /api/moderation/flags/:id
 */
const updateModerationFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    // Validate status
    const validStatuses = ['PENDING', 'VALID', 'INVALID'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Valid status is required (PENDING, VALID, INVALID)' });
    }

    const flag = await req.prisma.moderationFlag.findUnique({
      where: { id }
    });

    if (!flag) {
      return res.status(404).json({ error: 'Moderation flag not found' });
    }

    const updatedFlag = await req.prisma.moderationFlag.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
        ...(adminNotes && { reason: adminNotes.trim() })
      },
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

    res.json({
      message: 'Moderation flag updated successfully',
      flag: updatedFlag
    });
  } catch (error) {
    console.error('Error updating moderation flag:', error);
    res.status(500).json({ error: 'Failed to update moderation flag' });
  }
};

/**
 * Delete content (admin action)
 * DELETE /api/moderation/content/:entityType/:entityId
 */
const deleteContent = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { reason } = req.body;

    // Validate entity type
    const validEntityTypes = ['POST', 'COMMENT'];
    if (!validEntityTypes.includes(entityType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid entity type (POST, COMMENT only)' });
    }

    let deletedEntity = null;

    switch (entityType.toUpperCase()) {
      case 'POST':
        // Check if post exists
        const post = await req.prisma.post.findUnique({
          where: { id: entityId, deletedAt: null }
        });

        if (!post) {
          return res.status(404).json({ error: 'Post not found or already deleted' });
        }

        // Soft delete the post
        deletedEntity = await req.prisma.post.update({
          where: { id: entityId },
          data: { deletedAt: new Date() }
        });
        break;

      case 'COMMENT':
        // Check if comment exists
        const comment = await req.prisma.comment.findUnique({
          where: { id: entityId, deletedAt: null }
        });

        if (!comment) {
          return res.status(404).json({ error: 'Comment not found or already deleted' });
        }

        // Soft delete the comment
        deletedEntity = await req.prisma.comment.update({
          where: { id: entityId },
          data: { deletedAt: new Date() }
        });
        break;
    }

    // Update related moderation flags to VALID
    await req.prisma.moderationFlag.updateMany({
      where: {
        entityType: entityType.toUpperCase(),
        entityId,
        status: 'PENDING'
      },
      data: {
        status: 'VALID',
        reason: reason || 'Content deleted by moderator'
      }
    });

    res.json({
      message: `${entityType.toLowerCase()} deleted successfully`,
      deletedEntity
    });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
};

/**
 * Suspend user (admin action)
 * POST /api/moderation/users/:userId/suspend
 */
const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { duration, reason } = req.body; // duration in hours

    if (!duration || duration <= 0) {
      return res.status(400).json({ error: 'Valid suspension duration in hours is required' });
    }

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate suspension end time
    const suspendedUntil = new Date();
    suspendedUntil.setHours(suspendedUntil.getHours() + parseInt(duration));

    const suspendedUser = await req.prisma.user.update({
      where: { id: userId },
      data: { suspendedUntil },
      select: {
        id: true,
        username: true,
        displayName: true,
        suspendedUntil: true
      }
    });

    // Update related moderation flags to VALID
    await req.prisma.moderationFlag.updateMany({
      where: {
        entityType: 'USER',
        entityId: userId,
        status: 'PENDING'
      },
      data: {
        status: 'VALID',
        reason: reason || `User suspended for ${duration} hours`
      }
    });

    res.json({
      message: 'User suspended successfully',
      user: suspendedUser,
      suspendedUntil
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
};

/**
 * Unsuspend user (admin action)
 * POST /api/moderation/users/:userId/unsuspend
 */
const unsuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const unsuspendedUser = await req.prisma.user.update({
      where: { id: userId },
      data: { suspendedUntil: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        suspendedUntil: true
      }
    });

    res.json({
      message: 'User unsuspended successfully',
      user: unsuspendedUser
    });
  } catch (error) {
    console.error('Error unsuspending user:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
};

/**
 * Get moderation statistics (admin only)
 * GET /api/moderation/stats
 */
const getModerationStats = async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get flag counts by status
    const flagsByStatus = await req.prisma.moderationFlag.groupBy({
      by: ['status'],
      _count: { status: true },
      where: {
        createdAt: { gte: startDate }
      }
    });

    // Get flag counts by entity type
    const flagsByEntityType = await req.prisma.moderationFlag.groupBy({
      by: ['entityType'],
      _count: { entityType: true },
      where: {
        createdAt: { gte: startDate }
      }
    });

    // Get total counts
    const totalFlags = await req.prisma.moderationFlag.count({
      where: { createdAt: { gte: startDate } }
    });

    const pendingFlags = await req.prisma.moderationFlag.count({
      where: { 
        status: 'PENDING',
        createdAt: { gte: startDate }
      }
    });

    const suspendedUsers = await req.prisma.user.count({
      where: {
        suspendedUntil: { gt: new Date() }
      }
    });

    // Format response
    const statusStats = {
      PENDING: 0,
      VALID: 0,
      INVALID: 0
    };

    flagsByStatus.forEach(stat => {
      statusStats[stat.status] = stat._count.status;
    });

    const entityTypeStats = {
      POST: 0,
      COMMENT: 0,
      USER: 0
    };

    flagsByEntityType.forEach(stat => {
      entityTypeStats[stat.entityType] = stat._count.entityType;
    });

    res.json({
      period,
      totalFlags,
      pendingFlags,
      suspendedUsers,
      flagsByStatus: statusStats,
      flagsByEntityType: entityTypeStats
    });
  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    res.status(500).json({ error: 'Failed to fetch moderation statistics' });
  }
};

/**
 * Get user's reports
 * GET /api/moderation/my-reports
 */
const getUserReports = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reports = await req.prisma.moderationFlag.findMany({
      where: { reporterId: userId },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.moderationFlag.count({
      where: { reporterId: userId }
    });

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ error: 'Failed to fetch user reports' });
  }
};

module.exports = {
  reportContent,
  getModerationFlags,
  getModerationFlagById,
  updateModerationFlag,
  deleteContent,
  suspendUser,
  unsuspendUser,
  getModerationStats,
  getUserReports
};