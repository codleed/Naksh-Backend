const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { clerkMiddleware } = require('@clerk/express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhooks');
const mediaRoutes = require('./routes/media');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const reactionRoutes = require('./routes/reactions');
const followRoutes = require('./routes/follows');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const moderationRoutes = require('./routes/moderation');
const deviceTokenRoutes = require('./routes/deviceTokens');

// Import error handling utilities
const { 
  errorHandler, 
  notFoundHandler, 
  handleUncaughtException, 
  handleUnhandledRejection, 
  handleGracefulShutdown 
} = require('./middleware/errorHandler');
const { responseMiddleware } = require('./utils/response');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Handle uncaught exceptions
handleUncaughtException();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Raw body parser for webhooks (must be before express.json())
app.use('/api/webhooks', webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clerk middleware
app.use(clerkMiddleware());

// Response helpers middleware
app.use(responseMiddleware);

// Make prisma available to all routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/device-tokens', deviceTokenRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await req.prisma.$queryRaw`SELECT 1`;
    
    res.health({
      database: { status: 'healthy' },
      server: { status: 'healthy' }
    });
  } catch (error) {
    res.health({
      database: { status: 'unhealthy', error: error.message },
      server: { status: 'healthy' }
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.apiInfo({
    name: 'Naksh API',
    version: '1.0.0',
    description: 'Naksh Social Media Platform API Server'
  });
});

// 404 handler (must be before error handler)
app.use('*', notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
handleUnhandledRejection(server);

// Handle graceful shutdown
handleGracefulShutdown(server, prisma);

module.exports = app;