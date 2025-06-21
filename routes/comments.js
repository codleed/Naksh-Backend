const express = require('express');
const router = express.Router();

// GET /api/comments - Get comments with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      postId,
      authorId,
      parentCommentId 
    } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(postId && { postId }),
      ...(authorId && { authorId }),
      ...(parentCommentId && { parentCommentId })
    };

    const comments = await req.prisma.comment.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
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
        },
        parentComment: {
          select: {
            id: true,
            body: true,
            author: {
              select: {
                id: true,
                username: true
              }
            }
          }
        },
        _count: {
          select: {
            replies: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.comment.count({ where });

    res.json({
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// GET /api/comments/:id - Get comment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await req.prisma.comment.findUnique({
      where: { id },
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
        },
        parentComment: {
          select: {
            id: true,
            body: true,
            author: {
              select: {
                id: true,
                username: true
              }
            }
          }
        },
        replies: {
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
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!comment || comment.deletedAt) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(comment);
  } catch (error) {
    console.error('Error fetching comment:', error);
    res.status(500).json({ error: 'Failed to fetch comment' });
  }
});

// POST /api/comments - Create new comment
router.post('/', async (req, res) => {
  try {
    const { postId, authorId, parentCommentId, body } = req.body;

    if (!postId || !authorId || !body) {
      return res.status(400).json({ 
        error: 'Post ID, author ID, and body are required' 
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
      return res.status(400).json({ error: 'Cannot comment on expired post' });
    }

    // If replying to a comment, verify parent comment exists
    if (parentCommentId) {
      const parentComment = await req.prisma.comment.findUnique({
        where: { id: parentCommentId },
        select: { id: true, deletedAt: true, postId: true }
      });

      if (!parentComment || parentComment.deletedAt) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }

      if (parentComment.postId !== postId) {
        return res.status(400).json({ 
          error: 'Parent comment must belong to the same post' 
        });
      }
    }

    const comment = await req.prisma.comment.create({
      data: {
        postId,
        authorId,
        parentCommentId,
        body
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
        post: {
          select: {
            id: true,
            caption: true
          }
        },
        parentComment: {
          select: {
            id: true,
            body: true,
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

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PUT /api/comments/:id - Update comment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Body is required' });
    }

    const comment = await req.prisma.comment.update({
      where: { id },
      data: { 
        body,
        editedAt: new Date()
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
        post: {
          select: {
            id: true,
            caption: true
          }
        }
      }
    });

    res.json(comment);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Comment not found' });
    }
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /api/comments/:id - Soft delete comment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Comment not found' });
    }
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// GET /api/comments/post/:postId - Get comments for a specific post
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20, sortBy = 'newest' } = req.query;
    const skip = (page - 1) * limit;

    let orderBy;
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Get top-level comments (no parent)
    const comments = await req.prisma.comment.findMany({
      where: {
        postId,
        parentCommentId: null,
        deletedAt: null
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        replies: {
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
          orderBy: { createdAt: 'asc' },
          take: 3 // Limit initial replies shown
        },
        _count: {
          select: {
            replies: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy
    });

    const total = await req.prisma.comment.count({
      where: {
        postId,
        parentCommentId: null,
        deletedAt: null
      }
    });

    res.json({
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching post comments:', error);
    res.status(500).json({ error: 'Failed to fetch post comments' });
  }
});

// GET /api/comments/:id/replies - Get replies to a comment
router.get('/:id/replies', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const replies = await req.prisma.comment.findMany({
      where: {
        parentCommentId: id,
        deletedAt: null
      },
      skip: parseInt(skip),
      take: parseInt(limit),
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
      orderBy: { createdAt: 'asc' }
    });

    const total = await req.prisma.comment.count({
      where: {
        parentCommentId: id,
        deletedAt: null
      }
    });

    res.json({
      replies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching comment replies:', error);
    res.status(500).json({ error: 'Failed to fetch comment replies' });
  }
});

module.exports = router;