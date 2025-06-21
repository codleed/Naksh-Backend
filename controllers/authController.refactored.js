/**
 * Auth Controller - Refactored with new error handling system
 * Demonstrates how to use the new error handling utilities
 */

const { asyncHandler } = require('../utils/asyncHandler');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  AuthenticationError 
} = require('../utils/errors');
const { 
  validateRequired, 
  validateUsername, 
  validateStringLength 
} = require('../utils/validation');

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.auth?.userId) {
    throw new AuthenticationError();
  }

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
    throw new NotFoundError('User');
  }

  res.success(user, 'User profile retrieved successfully');
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { username, displayName, bio, isAnonymous } = req.body;
  const userId = req.auth.userId;

  if (!userId) {
    throw new AuthenticationError();
  }

  // Validate input
  if (username) {
    validateUsername(username);
  }
  
  if (bio) {
    validateStringLength(bio, 'bio', { maxLength: 500 });
  }

  // Check username uniqueness if provided
  if (username) {
    const existingUser = await req.prisma.user.findFirst({
      where: {
        username,
        clerkId: { not: userId }
      }
    });

    if (existingUser) {
      throw new ConflictError('Username already taken');
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

  res.success(user, 'Profile updated successfully');
});

/**
 * Complete user profile after registration
 * POST /api/auth/complete-profile
 */
const completeProfile = asyncHandler(async (req, res) => {
  const { username, bio } = req.body;
  const userId = req.auth.userId;

  if (!userId) {
    throw new AuthenticationError();
  }

  // Validate required fields
  validateRequired({ username }, ['username']);
  validateUsername(username);
  
  if (bio) {
    validateStringLength(bio, 'bio', { maxLength: 500 });
  }

  // Check username uniqueness
  const existingUser = await req.prisma.user.findFirst({
    where: {
      username,
      clerkId: { not: userId }
    }
  });

  if (existingUser) {
    throw new ConflictError('Username already taken');
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

  res.created(user, 'Profile completed successfully');
});

/**
 * Check if username is available
 * GET /api/auth/check-username
 */
const checkUsername = asyncHandler(async (req, res) => {
  const { username } = req.query;

  validateRequired({ username }, ['username']);
  validateUsername(username);

  const existingUser = await req.prisma.user.findUnique({
    where: { username },
    select: { id: true }
  });

  res.success({
    available: !existingUser,
    username
  }, 'Username availability checked');
});

/**
 * Delete user account
 * DELETE /api/auth/account
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;

  if (!userId) {
    throw new AuthenticationError();
  }

  // Use transaction for data consistency
  await req.prisma.$transaction(async (prisma) => {
    // Soft delete all user's posts
    await prisma.post.updateMany({
      where: { authorId: userId },
      data: { deletedAt: new Date() }
    });

    // Soft delete all user's comments
    await prisma.comment.updateMany({
      where: { authorId: userId },
      data: { deletedAt: new Date() }
    });

    // Delete user from database
    await prisma.user.delete({
      where: { clerkId: userId }
    });
  });

  res.noContent('Account deleted successfully');
});

/**
 * Get session information
 * GET /api/auth/session
 */
const getSession = asyncHandler(async (req, res) => {
  if (!req.auth?.userId) {
    return res.success({ authenticated: false }, 'Session information retrieved');
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

  res.success({
    authenticated: true,
    user,
    suspended: user?.suspendedUntil && new Date() < user.suspendedUntil
  }, 'Session information retrieved');
});

module.exports = {
  getCurrentUser,
  updateProfile,
  completeProfile,
  checkUsername,
  deleteAccount,
  getSession
};