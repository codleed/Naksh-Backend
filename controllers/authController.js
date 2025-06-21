/**
 * Auth Controller
 * Handles all authentication-related operations
 */

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      select: {
        id: true,
        clerkId: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isAnonymous: true,
        emailVerified: true,
        lastSignInAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            comments: true,
            reactions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { username, displayName, bio, isAnonymous } = req.body;
    const userId = req.auth.userId;

    // Validate username uniqueness if provided
    if (username) {
      const existingUser = await req.prisma.user.findFirst({
        where: {
          username,
          clerkId: { not: userId }
        }
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    const user = await req.prisma.user.update({
      where: { clerkId: userId },
      data: {
        ...(username && { username }),
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(isAnonymous !== undefined && { isAnonymous })
      },
      select: {
        id: true,
        clerkId: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isAnonymous: true,
        emailVerified: true,
        updatedAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
};

/**
 * Complete user profile after registration
 * POST /api/auth/complete-profile
 */
const completeProfile = async (req, res) => {
  try {
    const { username, bio } = req.body;
    const userId = req.auth.userId;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check username uniqueness
    const existingUser = await req.prisma.user.findFirst({
      where: {
        username,
        clerkId: { not: userId }
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const user = await req.prisma.user.update({
      where: { clerkId: userId },
      data: {
        username,
        bio: bio || null
      },
      select: {
        id: true,
        clerkId: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        isAnonymous: true,
        emailVerified: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error completing user profile:', error);
    res.status(500).json({ error: 'Failed to complete user profile' });
  }
};

/**
 * Check if username is available
 * GET /api/auth/check-username
 */
const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const existingUser = await req.prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    res.json({
      available: !existingUser,
      username
    });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
};

/**
 * Delete user account
 * DELETE /api/auth/account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.auth.userId;

    // Soft delete all user's posts
    await req.prisma.post.updateMany({
      where: { authorId: userId },
      data: { deletedAt: new Date() }
    });

    // Soft delete all user's comments
    await req.prisma.comment.updateMany({
      where: { authorId: userId },
      data: { deletedAt: new Date() }
    });

    // Delete user from database
    await req.prisma.user.delete({
      where: { clerkId: userId }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

/**
 * Get session information
 * GET /api/auth/session
 */
const getSession = async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.json({ authenticated: false });
    }

    const user = await req.prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        emailVerified: true,
        suspendedUntil: true
      }
    });

    res.json({
      authenticated: true,
      user,
      suspended: user?.suspendedUntil && new Date() < user.suspendedUntil
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
};

module.exports = {
  getCurrentUser,
  updateProfile,
  completeProfile,
  checkUsername,
  deleteAccount,
  getSession
};