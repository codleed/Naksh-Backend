/**
 * User Controller
 * Handles all user-related operations
 */

/**
 * Get all users with pagination and search
 * GET /api/users
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const users = await req.prisma.user.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isAnonymous: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.user.count({ where });

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeStats = false } = req.query;

    const user = await req.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isAnonymous: true,
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
        ...(includeStats === 'true' && {
          _count: {
            select: {
              posts: true,
              comments: true,
              reactions: true,
              followers: true,
              following: true
            }
          }
        })
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/**
 * Create new user
 * POST /api/users
 */
const createUser = async (req, res) => {
  try {
    const { username, displayName, email, avatarUrl, bio, isAnonymous = false } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    const user = await req.prisma.user.create({
      data: {
        username,
        displayName,
        email,
        avatarUrl,
        bio,
        isAnonymous
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isAnonymous: true,
        createdAt: true
      }
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, displayName, email, avatarUrl, bio } = req.body;

    const user = await req.prisma.user.update({
      where: { id },
      data: {
        ...(username && { username }),
        ...(displayName !== undefined && { displayName }),
        ...(email && { email }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(bio !== undefined && { bio })
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isAnonymous: true,
        updatedAt: true
      }
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

/**
 * Delete user
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.user.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

/**
 * Suspend user
 * POST /api/users/:id/suspend
 */
const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { suspendUntil } = req.body;

    if (!suspendUntil) {
      return res.status(400).json({ error: 'suspendUntil date is required' });
    }

    const user = await req.prisma.user.update({
      where: { id },
      data: { suspendedUntil: new Date(suspendUntil) },
      select: {
        id: true,
        username: true,
        suspendedUntil: true
      }
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
};

/**
 * Unsuspend user
 * POST /api/users/:id/unsuspend
 */
const unsuspendUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await req.prisma.user.update({
      where: { id },
      data: { suspendedUntil: null },
      select: {
        id: true,
        username: true,
        suspendedUntil: true
      }
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Error unsuspending user:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
};

/**
 * Get user's posts
 * GET /api/users/:id/posts
 */
const getUserPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await req.prisma.post.findMany({
      where: { 
        authorId: id,
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
        media: true,
        _count: {
          select: {
            reactions: true,
            comments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  suspendUser,
  unsuspendUser,
  getUserPosts
};