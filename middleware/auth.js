const { clerkMiddleware } = require('@clerk/express');

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  if (!req.auth?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please sign in to access this resource'
    });
  }
  next();
};

// Middleware to optionally check authentication
const withAuth = (req, res, next) => {
  // For optional auth, we'll check if the user is authenticated
  // but won't throw an error if they're not
  if (!req.auth) {
    req.auth = { userId: null };
  }
  next();
};

// Middleware to get or create user in database
const syncUser = async (req, res, next) => {
  try {
    if (!req.auth?.userId) {
      return next();
    }

    const { userId } = req.auth;
    
    // Check if user exists in our database
    let user = await req.prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!user) {
      // For now, we'll create a basic user record
      // The webhook will handle the full user data sync
      user = await req.prisma.user.create({
        data: {
          id: userId,
          clerkId: userId,
          email: `user_${userId.slice(-8)}@temp.com`, // Temporary email
          username: `user_${userId.slice(-8)}`,
          lastSignInAt: new Date(),
        }
      });
    } else {
      // Update user's last sign in time
      user = await req.prisma.user.update({
        where: { clerkId: userId },
        data: {
          lastSignInAt: new Date()
        }
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error syncing user:', error);
    // If user creation fails, continue without user data
    req.user = null;
    next();
  }
};

// Middleware to check if user is suspended
const checkSuspension = (req, res, next) => {
  if (req.user?.suspendedUntil && new Date() < req.user.suspendedUntil) {
    return res.status(403).json({
      error: 'Account suspended',
      message: `Your account is suspended until ${req.user.suspendedUntil.toISOString()}`,
      suspendedUntil: req.user.suspendedUntil
    });
  }
  next();
};

module.exports = {
  requireAuth,
  withAuth,
  syncUser,
  checkSuspension
};