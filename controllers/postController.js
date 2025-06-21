/**
 * Post Controller
 * Handles all post-related operations
 */

/**
 * Get all posts with pagination, filtering, and search
 * GET /api/posts
 */
const getAllPosts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      visibility = 'PUBLIC',
      authorId,
      search,
      includeExpired = false,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;
    const currentTime = new Date();

    // Build where clause
    const where = {
      deletedAt: null,
      ...(visibility && { visibility }),
      ...(authorId && { authorId }),
      ...(includeExpired !== 'true' && { expiresAt: { gt: currentTime } }),
      ...(search && {
        OR: [
          { caption: { contains: search, mode: 'insensitive' } },
          { locationName: { contains: search, mode: 'insensitive' } },
          { author: { 
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } }
            ]
          }}
        ]
      })
    };

    // Build orderBy clause
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const posts = await req.prisma.post.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        },
        media: {
          orderBy: { ordering: 'asc' }
        },
        anonymousPost: true,
        _count: {
          select: {
            reactions: true,
            comments: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy
    });

    const total = await req.prisma.post.count({ where });

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

/**
 * Get post by ID
 * GET /api/posts/:id
 */
const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeComments = false } = req.query;

    const post = await req.prisma.post.findUnique({
      where: { 
        id,
        deletedAt: null
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        },
        media: {
          orderBy: { ordering: 'asc' }
        },
        anonymousPost: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        ...(includeComments === 'true' && {
          comments: {
            where: { 
              deletedAt: null,
              parentCommentId: null // Only top-level comments
            },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isAnonymous: true
                }
              },
              _count: {
                select: {
                  replies: {
                    where: { deletedAt: null }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10 // Limit initial comments
          }
        }),
        _count: {
          select: {
            reactions: true,
            comments: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if post has expired
    if (post.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Post has expired' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

/**
 * Create new post
 * POST /api/posts
 */
const createPost = async (req, res) => {
  try {
    const { 
      caption, 
      locationName, 
      visibility = 'PUBLIC',
      media = [],
      isAnonymous = false,
      anonName,
      anonAvatarUrl,
      boostUntil
    } = req.body;
    
    const authorId = req.user?.id;

    if (!authorId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required fields
    if (!caption && (!media || media.length === 0)) {
      return res.status(400).json({ error: 'Post must have either caption or media' });
    }

    // Validate visibility enum
    const validVisibilities = ['PUBLIC', 'PRIVATE', 'FOLLOWERS'];
    if (!validVisibilities.includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value' });
    }

    // Validate media array
    if (media && media.length > 0) {
      for (const mediaItem of media) {
        if (!mediaItem.mediaUrl || !mediaItem.type) {
          return res.status(400).json({ error: 'Each media item must have mediaUrl and type' });
        }
        if (!['IMAGE', 'VIDEO'].includes(mediaItem.type)) {
          return res.status(400).json({ error: 'Media type must be IMAGE or VIDEO' });
        }
      }
    }

    // Create post with transaction to ensure consistency
    const result = await req.prisma.$transaction(async (prisma) => {
      // Create the post
      const post = await prisma.post.create({
        data: {
          caption,
          locationName,
          visibility,
          authorId,
          ...(boostUntil && { boostUntil: new Date(boostUntil) })
        }
      });

      // Create media if provided
      if (media && media.length > 0) {
        await prisma.postMedia.createMany({
          data: media.map((mediaItem, index) => ({
            postId: post.id,
            mediaUrl: mediaItem.mediaUrl,
            type: mediaItem.type,
            ordering: mediaItem.ordering || index,
            duration: mediaItem.duration
          }))
        });
      }

      // Create anonymous post data if needed
      if (isAnonymous) {
        await prisma.anonymousPost.create({
          data: {
            postId: post.id,
            anonName,
            anonAvatarUrl
          }
        });
      }

      return post;
    });

    // Fetch the complete post with relations
    const createdPost = await req.prisma.post.findUnique({
      where: { id: result.id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        },
        media: {
          orderBy: { ordering: 'asc' }
        },
        anonymousPost: true,
        _count: {
          select: {
            reactions: true,
            comments: true
          }
        }
      }
    });

    res.status(201).json(createdPost);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

/**
 * Update post
 * PUT /api/posts/:id
 */
const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, locationName, visibility, boostUntil } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if post exists and user owns it
    const existingPost = await req.prisma.post.findUnique({
      where: { 
        id,
        deletedAt: null
      }
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existingPost.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this post' });
    }

    // Check if post has expired
    if (existingPost.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Cannot update expired post' });
    }

    // Validate visibility if provided
    if (visibility) {
      const validVisibilities = ['PUBLIC', 'PRIVATE', 'FOLLOWERS'];
      if (!validVisibilities.includes(visibility)) {
        return res.status(400).json({ error: 'Invalid visibility value' });
      }
    }

    const post = await req.prisma.post.update({
      where: { id },
      data: {
        ...(caption !== undefined && { caption }),
        ...(locationName !== undefined && { locationName }),
        ...(visibility && { visibility }),
        ...(boostUntil && { boostUntil: new Date(boostUntil) })
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        },
        media: {
          orderBy: { ordering: 'asc' }
        },
        anonymousPost: true,
        _count: {
          select: {
            reactions: true,
            comments: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    res.json(post);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
};

/**
 * Delete post (soft delete)
 * DELETE /api/posts/:id
 */
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if post exists and user owns it
    const existingPost = await req.prisma.post.findUnique({
      where: { 
        id,
        deletedAt: null
      }
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existingPost.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Soft delete the post
    await req.prisma.post.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

/**
 * Get posts by location (nearby posts)
 * GET /api/posts/nearby
 */
const getNearbyPosts = async (req, res) => {
  try {
    const { latitude, longitude, radius = 1000, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Note: This is a simplified version. For production, you'd want to use PostGIS functions
    // for proper geographic queries with the geography column
    const posts = await req.prisma.post.findMany({
      where: {
        deletedAt: null,
        expiresAt: { gt: new Date() },
        visibility: 'PUBLIC',
        locationName: { not: null }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        },
        media: {
          orderBy: { ordering: 'asc' }
        },
        anonymousPost: true,
        _count: {
          select: {
            reactions: true,
            comments: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: posts.length
      }
    });
  } catch (error) {
    console.error('Error fetching nearby posts:', error);
    res.status(500).json({ error: 'Failed to fetch nearby posts' });
  }
};

/**
 * Get trending posts
 * GET /api/posts/trending
 */
const getTrendingPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, timeframe = '24h' } = req.query;
    const skip = (page - 1) * limit;

    // Calculate time threshold based on timeframe
    const now = new Date();
    let timeThreshold;
    switch (timeframe) {
      case '1h':
        timeThreshold = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        timeThreshold = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get posts with reaction and comment counts for trending calculation
    const posts = await req.prisma.post.findMany({
      where: {
        deletedAt: null,
        expiresAt: { gt: now },
        visibility: 'PUBLIC',
        createdAt: { gte: timeThreshold }
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAnonymous: true
          }
        },
        media: {
          orderBy: { ordering: 'asc' }
        },
        anonymousPost: true,
        _count: {
          select: {
            reactions: true,
            comments: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    // Sort by engagement (reactions + comments) and recency
    const trendingPosts = posts
      .map(post => ({
        ...post,
        engagementScore: post._count.reactions + post._count.comments * 2 // Comments weighted more
      }))
      .sort((a, b) => {
        // Primary sort by engagement score
        if (b.engagementScore !== a.engagementScore) {
          return b.engagementScore - a.engagementScore;
        }
        // Secondary sort by recency
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(skip, skip + parseInt(limit));

    res.json({
      posts: trendingPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: posts.length
      }
    });
  } catch (error) {
    console.error('Error fetching trending posts:', error);
    res.status(500).json({ error: 'Failed to fetch trending posts' });
  }
};

/**
 * Boost post (extend visibility/promotion)
 * POST /api/posts/:id/boost
 */
const boostPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { boostUntil } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!boostUntil) {
      return res.status(400).json({ error: 'boostUntil date is required' });
    }

    // Check if post exists and user owns it
    const existingPost = await req.prisma.post.findUnique({
      where: { 
        id,
        deletedAt: null
      }
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existingPost.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to boost this post' });
    }

    const post = await req.prisma.post.update({
      where: { id },
      data: {
        boostUntil: new Date(boostUntil)
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        _count: {
          select: {
            reactions: true,
            comments: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    res.json(post);
  } catch (error) {
    console.error('Error boosting post:', error);
    res.status(500).json({ error: 'Failed to boost post' });
  }
};

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getNearbyPosts,
  getTrendingPosts,
  boostPost
};