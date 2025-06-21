/**
 * Media Controller
 * Handles all media-related operations for posts
 */

/**
 * Get all media for a specific post
 * GET /api/posts/:postId/media
 */
const getPostMedia = async (req, res) => {
  try {
    const { postId } = req.params;
    const { type } = req.query;

    // Check if post exists
    const post = await req.prisma.post.findUnique({
      where: { 
        id: postId,
        deletedAt: null
      },
      select: {
        id: true,
        authorId: true,
        visibility: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Build where clause
    const where = {
      postId,
      ...(type && { type: type.toUpperCase() })
    };

    const media = await req.prisma.postMedia.findMany({
      where,
      orderBy: [
        { ordering: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    res.json({
      media,
      count: media.length,
      postId
    });
  } catch (error) {
    console.error('Error fetching post media:', error);
    res.status(500).json({ error: 'Failed to fetch post media' });
  }
};

/**
 * Get media by ID
 * GET /api/media/:id
 */
const getMediaById = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await req.prisma.postMedia.findUnique({
      where: { id },
      include: {
        post: {
          select: {
            id: true,
            authorId: true,
            caption: true,
            visibility: true,
            createdAt: true,
            author: {
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

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    res.json(media);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
};

/**
 * Add media to a post
 * POST /api/posts/:postId/media
 */
const addMediaToPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { mediaUrl, type = 'IMAGE', ordering, duration } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!mediaUrl) {
      return res.status(400).json({ error: 'Media URL is required' });
    }

    // Validate media type
    if (!['IMAGE', 'VIDEO'].includes(type.toUpperCase())) {
      return res.status(400).json({ error: 'Media type must be IMAGE or VIDEO' });
    }

    // Check if post exists and user owns it
    const post = await req.prisma.post.findUnique({
      where: { 
        id: postId,
        deletedAt: null
      },
      select: {
        id: true,
        authorId: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to add media to this post' });
    }

    // If ordering not provided, get the next available ordering
    let finalOrdering = ordering;
    if (finalOrdering === undefined || finalOrdering === null) {
      const lastMedia = await req.prisma.postMedia.findFirst({
        where: { postId },
        orderBy: { ordering: 'desc' },
        select: { ordering: true }
      });
      finalOrdering = (lastMedia?.ordering || 0) + 1;
    }

    // Validate duration for videos
    if (type.toUpperCase() === 'VIDEO' && duration !== undefined && duration <= 0) {
      return res.status(400).json({ error: 'Video duration must be positive' });
    }

    const media = await req.prisma.postMedia.create({
      data: {
        postId,
        mediaUrl,
        type: type.toUpperCase(),
        ordering: finalOrdering,
        ...(duration && { duration })
      },
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      message: 'Media added successfully',
      media
    });
  } catch (error) {
    console.error('Error adding media to post:', error);
    res.status(500).json({ error: 'Failed to add media to post' });
  }
};

/**
 * Update media
 * PUT /api/media/:id
 */
const updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { mediaUrl, type, ordering, duration } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if media exists and user owns the post
    const existingMedia = await req.prisma.postMedia.findUnique({
      where: { id },
      include: {
        post: {
          select: {
            id: true,
            authorId: true
          }
        }
      }
    });

    if (!existingMedia) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (existingMedia.post.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this media' });
    }

    // Validate media type if provided
    if (type && !['IMAGE', 'VIDEO'].includes(type.toUpperCase())) {
      return res.status(400).json({ error: 'Media type must be IMAGE or VIDEO' });
    }

    // Validate duration for videos
    if (duration !== undefined && duration <= 0) {
      return res.status(400).json({ error: 'Video duration must be positive' });
    }

    const media = await req.prisma.postMedia.update({
      where: { id },
      data: {
        ...(mediaUrl && { mediaUrl }),
        ...(type && { type: type.toUpperCase() }),
        ...(ordering !== undefined && { ordering }),
        ...(duration !== undefined && { duration })
      },
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    res.json({
      message: 'Media updated successfully',
      media
    });
  } catch (error) {
    console.error('Error updating media:', error);
    res.status(500).json({ error: 'Failed to update media' });
  }
};

/**
 * Delete media
 * DELETE /api/media/:id
 */
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if media exists and user owns the post
    const existingMedia = await req.prisma.postMedia.findUnique({
      where: { id },
      include: {
        post: {
          select: {
            id: true,
            authorId: true
          }
        }
      }
    });

    if (!existingMedia) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (existingMedia.post.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this media' });
    }

    await req.prisma.postMedia.delete({
      where: { id }
    });

    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
};

/**
 * Reorder media for a post
 * PUT /api/posts/:postId/media/reorder
 */
const reorderPostMedia = async (req, res) => {
  try {
    const { postId } = req.params;
    const { mediaOrder } = req.body; // Array of { id, ordering } objects
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!mediaOrder || !Array.isArray(mediaOrder)) {
      return res.status(400).json({ error: 'mediaOrder array is required' });
    }

    // Check if post exists and user owns it
    const post = await req.prisma.post.findUnique({
      where: { 
        id: postId,
        deletedAt: null
      },
      select: {
        id: true,
        authorId: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to reorder media for this post' });
    }

    // Validate that all media items belong to this post
    const mediaIds = mediaOrder.map(item => item.id);
    const existingMedia = await req.prisma.postMedia.findMany({
      where: {
        id: { in: mediaIds },
        postId
      },
      select: { id: true }
    });

    if (existingMedia.length !== mediaIds.length) {
      return res.status(400).json({ error: 'Some media items do not belong to this post' });
    }

    // Update ordering for each media item
    const updatePromises = mediaOrder.map(item => 
      req.prisma.postMedia.update({
        where: { id: item.id },
        data: { ordering: item.ordering }
      })
    );

    await Promise.all(updatePromises);

    // Fetch updated media
    const updatedMedia = await req.prisma.postMedia.findMany({
      where: { postId },
      orderBy: { ordering: 'asc' }
    });

    res.json({
      message: 'Media reordered successfully',
      media: updatedMedia
    });
  } catch (error) {
    console.error('Error reordering media:', error);
    res.status(500).json({ error: 'Failed to reorder media' });
  }
};

/**
 * Bulk add media to a post
 * POST /api/posts/:postId/media/bulk
 */
const bulkAddMediaToPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { mediaItems } = req.body; // Array of media objects
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!mediaItems || !Array.isArray(mediaItems) || mediaItems.length === 0) {
      return res.status(400).json({ error: 'mediaItems array is required' });
    }

    if (mediaItems.length > 10) {
      return res.status(400).json({ error: 'Cannot add more than 10 media items at once' });
    }

    // Check if post exists and user owns it
    const post = await req.prisma.post.findUnique({
      where: { 
        id: postId,
        deletedAt: null
      },
      select: {
        id: true,
        authorId: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to add media to this post' });
    }

    // Validate all media items
    for (const item of mediaItems) {
      if (!item.mediaUrl) {
        return res.status(400).json({ error: 'All media items must have mediaUrl' });
      }
      if (item.type && !['IMAGE', 'VIDEO'].includes(item.type.toUpperCase())) {
        return res.status(400).json({ error: 'Media type must be IMAGE or VIDEO' });
      }
      if (item.duration !== undefined && item.duration <= 0) {
        return res.status(400).json({ error: 'Video duration must be positive' });
      }
    }

    // Get the current highest ordering
    const lastMedia = await req.prisma.postMedia.findFirst({
      where: { postId },
      orderBy: { ordering: 'desc' },
      select: { ordering: true }
    });

    let currentOrdering = (lastMedia?.ordering || 0) + 1;

    // Prepare media data
    const mediaData = mediaItems.map((item, index) => ({
      postId,
      mediaUrl: item.mediaUrl,
      type: (item.type || 'IMAGE').toUpperCase(),
      ordering: item.ordering !== undefined ? item.ordering : currentOrdering + index,
      ...(item.duration && { duration: item.duration })
    }));

    // Create all media items
    const createdMedia = await req.prisma.postMedia.createMany({
      data: mediaData
    });

    // Fetch the created media with relations
    const media = await req.prisma.postMedia.findMany({
      where: { postId },
      orderBy: { ordering: 'asc' },
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      message: `Successfully added ${createdMedia.count} media items`,
      addedCount: createdMedia.count,
      media
    });
  } catch (error) {
    console.error('Error bulk adding media:', error);
    res.status(500).json({ error: 'Failed to bulk add media' });
  }
};

/**
 * Get media statistics for a post
 * GET /api/posts/:postId/media/stats
 */
const getPostMediaStats = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const post = await req.prisma.post.findUnique({
      where: { 
        id: postId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [totalMedia, imageCount, videoCount, totalDuration] = await Promise.all([
      req.prisma.postMedia.count({
        where: { postId }
      }),
      req.prisma.postMedia.count({
        where: { postId, type: 'IMAGE' }
      }),
      req.prisma.postMedia.count({
        where: { postId, type: 'VIDEO' }
      }),
      req.prisma.postMedia.aggregate({
        where: { postId, type: 'VIDEO' },
        _sum: { duration: true }
      })
    ]);

    res.json({
      postId,
      stats: {
        total: totalMedia,
        images: imageCount,
        videos: videoCount,
        totalVideoDuration: totalDuration._sum.duration || 0
      }
    });
  } catch (error) {
    console.error('Error fetching media stats:', error);
    res.status(500).json({ error: 'Failed to fetch media statistics' });
  }
};

/**
 * Get user's media across all posts
 * GET /api/users/:userId/media
 */
const getUserMedia = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const where = {
      post: {
        authorId: userId,
        deletedAt: null
      },
      ...(type && { type: type.toUpperCase() })
    };

    const media = await req.prisma.postMedia.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            createdAt: true,
            visibility: true
          }
        }
      },
      orderBy: [
        { post: { createdAt: 'desc' } },
        { ordering: 'asc' }
      ]
    });

    const total = await req.prisma.postMedia.count({ where });

    res.json({
      media,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Error fetching user media:', error);
    res.status(500).json({ error: 'Failed to fetch user media' });
  }
};

module.exports = {
  getPostMedia,
  getMediaById,
  addMediaToPost,
  updateMedia,
  deleteMedia,
  reorderPostMedia,
  bulkAddMediaToPost,
  getPostMediaStats,
  getUserMedia
};