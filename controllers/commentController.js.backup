/**
 * Comment Controller
 * Handles all comment-related operations
 */

/**
 * Get all comments for a post with pagination
 * GET /api/posts/:postId/comments
 */
const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 10, includeReplies = false } = req.query;
    const skip = (page - 1) * limit;

    // First check if post exists
    const post = await req.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const where = {
      postId,
      deletedAt: null,
      // Only get top-level comments if includeReplies is false
      ...(includeReplies !== 'true' && { parentCommentId: null })
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
            avatarUrl: true,
            isAnonymous: true
          }
        },
        ...(includeReplies === 'true' && {
          replies: {
            where: { deletedAt: null },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isAnonymous: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        }),
        _count: {
          select: {
            replies: {
              where: { deletedAt: null }
            }
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
    console.error('Error fetching post comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

/**
 * Get comment by ID
 * GET /api/comments/:id
 */
const getCommentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeReplies = false } = req.query;

    const comment = await req.prisma.comment.findUnique({
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
        post: {
          select: {
            id: true,
            caption: true,
            authorId: true
          }
        },
        parentComment: {
          select: {
            id: true,
            body: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        },
        ...(includeReplies === 'true' && {
          replies: {
            where: { deletedAt: null },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isAnonymous: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        }),
        _count: {
          select: {
            replies: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(comment);
  } catch (error) {
    console.error('Error fetching comment:', error);
    res.status(500).json({ error: 'Failed to fetch comment' });
  }
};

/**
 * Create new comment
 * POST /api/posts/:postId/comments
 */
const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { body, parentCommentId } = req.body;
    const authorId = req.user?.id; // Assuming user is attached to request via auth middleware

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    if (!authorId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if post exists
    const post = await req.prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // If replying to a comment, check if parent comment exists
    if (parentCommentId) {
      const parentComment = await req.prisma.comment.findUnique({
        where: { 
          id: parentCommentId,
          postId, // Ensure parent comment belongs to the same post
          deletedAt: null
        }
      });

      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    const comment = await req.prisma.comment.create({
      data: {
        body: body.trim(),
        postId,
        authorId,
        parentCommentId
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
        parentComment: parentCommentId ? {
          select: {
            id: true,
            body: true,
            author: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        } : false,
        _count: {
          select: {
            replies: {
              where: { deletedAt: null }
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
};

/**
 * Update comment
 * PUT /api/comments/:id
 */
const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const userId = req.user?.id;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if comment exists and user owns it
    const existingComment = await req.prisma.comment.findUnique({
      where: { 
        id,
        deletedAt: null
      }
    });

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this comment' });
    }

    const comment = await req.prisma.comment.update({
      where: { id },
      data: {
        body: body.trim(),
        editedAt: new Date()
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
      }
    });

    res.json(comment);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
};

/**
 * Delete comment (soft delete)
 * DELETE /api/comments/:id
 */
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if comment exists and user owns it
    const existingComment = await req.prisma.comment.findUnique({
      where: { 
        id,
        deletedAt: null
      }
    });

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.authorId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Soft delete the comment
    await req.prisma.comment.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

/**
 * Get comment replies
 * GET /api/comments/:id/replies
 */
const getCommentReplies = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Check if parent comment exists
    const parentComment = await req.prisma.comment.findUnique({
      where: { 
        id,
        deletedAt: null
      }
    });

    if (!parentComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

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
            avatarUrl: true,
            isAnonymous: true
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
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
};

/**
 * Get user's comments
 * GET /api/users/:userId/comments
 */
const getUserComments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const comments = await req.prisma.comment.findMany({
      where: {
        authorId: userId,
        deletedAt: null
      },
      skip: parseInt(skip),
      take: parseInt(limit),
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
        },
        parentComment: {
          select: {
            id: true,
            body: true,
            author: {
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
            replies: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.comment.count({
      where: {
        authorId: userId,
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
    console.error('Error fetching user comments:', error);
    res.status(500).json({ error: 'Failed to fetch user comments' });
  }
};

module.exports = {
  getPostComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  getCommentReplies,
  getUserComments
};