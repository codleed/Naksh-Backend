const express = require('express');
const { requireAuth, withAuth, syncUser, checkSuspension } = require('../middleware/auth');
const router = express.Router();

// GET /api/posts - Get all posts with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      visibility = 'PUBLIC',
      authorId,
      includeExpired = false 
    } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(visibility && { visibility }),
      ...(authorId && { authorId }),
      ...(includeExpired === 'false' && {
        expiresAt: { gt: new Date() }
      })
    };

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
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
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
});

// GET /api/posts/:id - Get post by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await req.prisma.post.findUnique({
      where: { id },
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
                displayName: true
              }
            }
          }
        },
        comments: {
          where: { deletedAt: null },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!post || post.deletedAt) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST /api/posts - Create new post
router.post('/', requireAuth, syncUser, checkSuspension, async (req, res) => {
  try {
    const { 
      caption, 
      location, 
      locationName, 
      visibility = 'PUBLIC',
      media = [],
      isAnonymous = false,
      anonName,
      anonAvatarUrl
    } = req.body;

    // Use authenticated user's ID
    const authorId = req.auth.userId;

    // Validate media URLs (ensure they're from Cloudinary)
    const validatedMedia = media.map((item, index) => {
      if (!item.mediaUrl || !item.mediaUrl.includes('cloudinary.com')) {
        throw new Error('Invalid media URL. Please upload media through /api/media/post first.');
      }
      
      return {
        mediaUrl: item.mediaUrl,
        type: item.type || 'IMAGE',
        ordering: item.ordering !== undefined ? item.ordering : index,
        duration: item.duration || null
      };
    });

    const postData = {
      authorId,
      caption,
      locationName,
      visibility,
      ...(location && { location })
    };

    const post = await req.prisma.post.create({
      data: {
        ...postData,
        ...(validatedMedia.length > 0 && {
          media: {
            create: validatedMedia
          }
        }),
        ...(isAnonymous && {
          anonymousPost: {
            create: {
              anonName,
              anonAvatarUrl
            }
          }
        })
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
            comments: true
          }
        }
      }
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: error.message || 'Failed to create post' });
  }
});

// PUT /api/posts/:id - Update post
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, locationName, visibility } = req.body;

    const post = await req.prisma.post.update({
      where: { id },
      data: {
        ...(caption !== undefined && { caption }),
        ...(locationName !== undefined && { locationName }),
        ...(visibility && { visibility })
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
        media: {
          orderBy: { ordering: 'asc' }
        },
        anonymousPost: true
      }
    });

    res.json(post);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Post not found' });
    }
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// DELETE /api/posts/:id - Soft delete post
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Post not found' });
    }
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// POST /api/posts/:id/boost - Boost post
router.post('/:id/boost', async (req, res) => {
  try {
    const { id } = req.params;
    const { boostUntil } = req.body;

    if (!boostUntil) {
      return res.status(400).json({ error: 'boostUntil date is required' });
    }

    const post = await req.prisma.post.update({
      where: { id },
      data: { boostUntil: new Date(boostUntil) },
      select: {
        id: true,
        caption: true,
        boostUntil: true
      }
    });

    res.json(post);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Post not found' });
    }
    console.error('Error boosting post:', error);
    res.status(500).json({ error: 'Failed to boost post' });
  }
});

// GET /api/posts/feed/:userId - Get personalized feed for user
router.get('/feed/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Get posts from followed users and own posts
    const posts = await req.prisma.post.findMany({
      where: {
        deletedAt: null,
        expiresAt: { gt: new Date() },
        OR: [
          { authorId: userId },
          {
            author: {
              followers: {
                some: { followerId: userId }
              }
            }
          },
          { visibility: 'PUBLIC' }
        ]
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
            comments: true
          }
        }
      },
      orderBy: [
        { boostUntil: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// GET /api/posts/trending - Get trending posts
router.get('/trending', async (req, res) => {
  try {
    const { page = 1, limit = 10, timeframe = '24h' } = req.query;
    const skip = (page - 1) * limit;

    // Calculate time threshold
    const timeThreshold = new Date();
    switch (timeframe) {
      case '1h':
        timeThreshold.setHours(timeThreshold.getHours() - 1);
        break;
      case '6h':
        timeThreshold.setHours(timeThreshold.getHours() - 6);
        break;
      case '24h':
        timeThreshold.setHours(timeThreshold.getHours() - 24);
        break;
      case '7d':
        timeThreshold.setDate(timeThreshold.getDate() - 7);
        break;
      default:
        timeThreshold.setHours(timeThreshold.getHours() - 24);
    }

    const posts = await req.prisma.post.findMany({
      where: {
        deletedAt: null,
        expiresAt: { gt: new Date() },
        createdAt: { gte: timeThreshold },
        visibility: 'PUBLIC'
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
            comments: true
          }
        }
      },
      orderBy: [
        { reactions: { _count: 'desc' } },
        { comments: { _count: 'desc' } },
        { createdAt: 'desc' }
      ]
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching trending posts:', error);
    res.status(500).json({ error: 'Failed to fetch trending posts' });
  }
});

module.exports = router;