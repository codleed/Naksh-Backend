const { clerkMiddleware } = require('@clerk/express');

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  const auth = typeof req.auth === 'function' ? req.auth() : req.auth;
  if (!auth?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please sign in to access this resource'
    });
  }
  req.auth = auth; // Ensure req.auth is the auth object, not a function
  next();
};

// Middleware to optionally check authentication
const withAuth = (req, res, next) => {
  // For optional auth, we'll check if the user is authenticated
  // but won't throw an error if they're not
  const auth = typeof req.auth === 'function' ? req.auth() : req.auth;
  req.auth = auth || { userId: null };
  next();
};

// Middleware to get or create user in database
const syncUser = async (req, res, next) => {
  try {
    const auth = typeof req.auth === 'function' ? req.auth() : req.auth;
    if (!auth?.userId) {
      return next();
    }

    const { userId } = auth;
    req.auth = auth; // Ensure req.auth is the auth object
    
    // Check if user exists in our database
    let user = await req.prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (!user) {
      // For now, we'll create a basic user record
      // The webhook will handle the full user data sync
      try {
        user = await req.prisma.user.create({
          data: {
            clerkId: userId,
            email: `user_${userId.slice(-8)}@temp.com`, // Temporary email
            username: `user_${userId.slice(-8)}`,
            lastSignInAt: new Date(),
          }
        });
      } catch (createError) {
        // If user creation fails (e.g., duplicate), try to find the user again
        console.log('User creation failed, attempting to find existing user:', createError.message);
        user = await req.prisma.user.findUnique({
          where: { clerkId: userId }
        });
        
        if (!user) {
          throw createError; // Re-throw if we still can't find the user
        }
      }
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