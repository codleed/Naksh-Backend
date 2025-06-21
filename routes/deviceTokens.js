const express = require('express');
const router = express.Router();

// GET /api/device-tokens - Get device tokens with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId,
      platform 
    } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(userId && { userId }),
      ...(platform && { platform })
    };

    const tokens = await req.prisma.deviceToken.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.deviceToken.count({ where });

    res.json({
      tokens,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching device tokens:', error);
    res.status(500).json({ error: 'Failed to fetch device tokens' });
  }
});

// GET /api/device-tokens/:id - Get device token by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const token = await req.prisma.deviceToken.findUnique({
      where: { id },
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
    });

    if (!token) {
      return res.status(404).json({ error: 'Device token not found' });
    }

    res.json(token);
  } catch (error) {
    console.error('Error fetching device token:', error);
    res.status(500).json({ error: 'Failed to fetch device token' });
  }
});

// POST /api/device-tokens - Register new device token
router.post('/', async (req, res) => {
  try {
    const { userId, token, platform } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ 
        error: 'User ID and token are required' 
      });
    }

    // Validate platform if provided
    if (platform && !['ios', 'android'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Invalid platform. Must be ios or android' 
      });
    }

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if token already exists
    const existingToken = await req.prisma.deviceToken.findUnique({
      where: { token }
    });

    if (existingToken) {
      // If token exists but for different user, update it
      if (existingToken.userId !== userId) {
        const updatedToken = await req.prisma.deviceToken.update({
          where: { token },
          data: { 
            userId,
            ...(platform && { platform })
          },
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
        });
        return res.json(updatedToken);
      } else {
        // Token already exists for this user
        return res.status(409).json({ 
          error: 'Device token already registered for this user',
          tokenId: existingToken.id
        });
      }
    }

    const deviceToken = await req.prisma.deviceToken.create({
      data: {
        userId,
        token,
        platform
      },
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
    });

    res.status(201).json(deviceToken);
  } catch (error) {
    console.error('Error creating device token:', error);
    res.status(500).json({ error: 'Failed to create device token' });
  }
});

// PUT /api/device-tokens/:id - Update device token
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { token, platform } = req.body;

    const deviceToken = await req.prisma.deviceToken.update({
      where: { id },
      data: {
        ...(token && { token }),
        ...(platform && { platform })
      },
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
    });

    res.json(deviceToken);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Device token not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Token already exists' });
    }
    console.error('Error updating device token:', error);
    res.status(500).json({ error: 'Failed to update device token' });
  }
});

// DELETE /api/device-tokens/:id - Delete device token
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.prisma.deviceToken.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Device token not found' });
    }
    console.error('Error deleting device token:', error);
    res.status(500).json({ error: 'Failed to delete device token' });
  }
});

// DELETE /api/device-tokens/token/:token - Delete device token by token value
router.delete('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    await req.prisma.deviceToken.delete({
      where: { token }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Device token not found' });
    }
    console.error('Error deleting device token:', error);
    res.status(500).json({ error: 'Failed to delete device token' });
  }
});

// GET /api/device-tokens/user/:userId - Get device tokens for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { platform } = req.query;

    const where = {
      userId,
      ...(platform && { platform })
    };

    const tokens = await req.prisma.deviceToken.findMany({
      where,
      select: {
        id: true,
        token: true,
        platform: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tokens);
  } catch (error) {
    console.error('Error fetching user device tokens:', error);
    res.status(500).json({ error: 'Failed to fetch user device tokens' });
  }
});

// POST /api/device-tokens/cleanup - Clean up invalid/expired tokens
router.post('/cleanup', async (req, res) => {
  try {
    const { invalidTokens = [] } = req.body;

    if (!Array.isArray(invalidTokens)) {
      return res.status(400).json({ error: 'Invalid tokens must be an array' });
    }

    let deletedCount = 0;

    if (invalidTokens.length > 0) {
      const result = await req.prisma.deviceToken.deleteMany({
        where: {
          token: { in: invalidTokens }
        }
      });
      deletedCount = result.count;
    }

    res.json({ 
      message: 'Token cleanup completed',
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up device tokens:', error);
    res.status(500).json({ error: 'Failed to cleanup device tokens' });
  }
});

// GET /api/device-tokens/stats - Get device token statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalTokens,
      iosTokens,
      androidTokens,
      tokensWithoutPlatform,
      recentTokens
    ] = await Promise.all([
      req.prisma.deviceToken.count(),
      req.prisma.deviceToken.count({ where: { platform: 'ios' } }),
      req.prisma.deviceToken.count({ where: { platform: 'android' } }),
      req.prisma.deviceToken.count({ where: { platform: null } }),
      req.prisma.deviceToken.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    const stats = {
      total: totalTokens,
      byPlatform: {
        ios: iosTokens,
        android: androidTokens,
        unknown: tokensWithoutPlatform
      },
      recentRegistrations: recentTokens
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching device token stats:', error);
    res.status(500).json({ error: 'Failed to fetch device token stats' });
  }
});

// POST /api/device-tokens/validate - Validate if tokens are still active
router.post('/validate', async (req, res) => {
  try {
    const { tokens } = req.body;

    if (!Array.isArray(tokens)) {
      return res.status(400).json({ error: 'Tokens must be an array' });
    }

    // Find which tokens exist in database
    const existingTokens = await req.prisma.deviceToken.findMany({
      where: {
        token: { in: tokens }
      },
      select: {
        token: true,
        userId: true,
        platform: true,
        createdAt: true
      }
    });

    const validTokens = existingTokens.map(t => t.token);
    const invalidTokens = tokens.filter(t => !validTokens.includes(t));

    res.json({
      valid: existingTokens,
      invalid: invalidTokens,
      summary: {
        total: tokens.length,
        valid: validTokens.length,
        invalid: invalidTokens.length
      }
    });
  } catch (error) {
    console.error('Error validating device tokens:', error);
    res.status(500).json({ error: 'Failed to validate device tokens' });
  }
});

module.exports = router;