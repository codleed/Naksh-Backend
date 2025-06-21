/**
 * Device Token Controller
 * Handles push notification device token management
 */

/**
 * Register a new device token
 * POST /api/device-tokens
 */
const registerDeviceToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Device token is required' });
    }

    // Validate platform if provided
    if (platform && !['ios', 'android'].includes(platform)) {
      return res.status(400).json({ error: 'Platform must be either "ios" or "android"' });
    }

    // Check if token already exists for this user
    const existingToken = await req.prisma.deviceToken.findUnique({
      where: { token }
    });

    if (existingToken) {
      // If token exists but for different user, update the user
      if (existingToken.userId !== userId) {
        const updatedToken = await req.prisma.deviceToken.update({
          where: { token },
          data: {
            userId,
            platform: platform || existingToken.platform
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        });

        return res.json({
          message: 'Device token updated for new user',
          deviceToken: updatedToken
        });
      }

      // If same user, just update platform if provided
      if (platform && existingToken.platform !== platform) {
        const updatedToken = await req.prisma.deviceToken.update({
          where: { token },
          data: { platform },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true
              }
            }
          }
        });

        return res.json({
          message: 'Device token platform updated',
          deviceToken: updatedToken
        });
      }

      return res.json({
        message: 'Device token already registered',
        deviceToken: existingToken
      });
    }

    // Create new device token
    const deviceToken = await req.prisma.deviceToken.create({
      data: {
        token,
        userId,
        platform
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Device token registered successfully',
      deviceToken
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Device token already exists' });
    }
    console.error('Error registering device token:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
};

/**
 * Get all device tokens for current user
 * GET /api/device-tokens
 */
const getUserDeviceTokens = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { platform } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const where = {
      userId,
      ...(platform && { platform })
    };

    const deviceTokens = await req.prisma.deviceToken.findMany({
      where,
      select: {
        id: true,
        token: true,
        platform: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      deviceTokens,
      count: deviceTokens.length
    });
  } catch (error) {
    console.error('Error fetching device tokens:', error);
    res.status(500).json({ error: 'Failed to fetch device tokens' });
  }
};

/**
 * Get device token by ID
 * GET /api/device-tokens/:id
 */
const getDeviceTokenById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const deviceToken = await req.prisma.deviceToken.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    if (!deviceToken) {
      return res.status(404).json({ error: 'Device token not found' });
    }

    // Check if user owns this token
    if (deviceToken.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this device token' });
    }

    res.json(deviceToken);
  } catch (error) {
    console.error('Error fetching device token:', error);
    res.status(500).json({ error: 'Failed to fetch device token' });
  }
};

/**
 * Update device token platform
 * PUT /api/device-tokens/:id
 */
const updateDeviceToken = async (req, res) => {
  try {
    const { id } = req.params;
    const { platform } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate platform
    if (platform && !['ios', 'android'].includes(platform)) {
      return res.status(400).json({ error: 'Platform must be either "ios" or "android"' });
    }

    // Check if device token exists and user owns it
    const existingToken = await req.prisma.deviceToken.findUnique({
      where: { id }
    });

    if (!existingToken) {
      return res.status(404).json({ error: 'Device token not found' });
    }

    if (existingToken.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this device token' });
    }

    const deviceToken = await req.prisma.deviceToken.update({
      where: { id },
      data: {
        ...(platform && { platform })
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    res.json({
      message: 'Device token updated successfully',
      deviceToken
    });
  } catch (error) {
    console.error('Error updating device token:', error);
    res.status(500).json({ error: 'Failed to update device token' });
  }
};

/**
 * Delete device token
 * DELETE /api/device-tokens/:id
 */
const deleteDeviceToken = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if device token exists and user owns it
    const existingToken = await req.prisma.deviceToken.findUnique({
      where: { id }
    });

    if (!existingToken) {
      return res.status(404).json({ error: 'Device token not found' });
    }

    if (existingToken.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this device token' });
    }

    await req.prisma.deviceToken.delete({
      where: { id }
    });

    res.json({ message: 'Device token deleted successfully' });
  } catch (error) {
    console.error('Error deleting device token:', error);
    res.status(500).json({ error: 'Failed to delete device token' });
  }
};

/**
 * Delete device token by token value
 * DELETE /api/device-tokens/token/:token
 */
const deleteDeviceTokenByValue = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Check if device token exists and user owns it
    const existingToken = await req.prisma.deviceToken.findUnique({
      where: { token }
    });

    if (!existingToken) {
      return res.status(404).json({ error: 'Device token not found' });
    }

    if (existingToken.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this device token' });
    }

    await req.prisma.deviceToken.delete({
      where: { token }
    });

    res.json({ message: 'Device token deleted successfully' });
  } catch (error) {
    console.error('Error deleting device token:', error);
    res.status(500).json({ error: 'Failed to delete device token' });
  }
};

/**
 * Delete all device tokens for current user
 * DELETE /api/device-tokens/all
 */
const deleteAllUserDeviceTokens = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { platform } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const where = {
      userId,
      ...(platform && { platform })
    };

    const result = await req.prisma.deviceToken.deleteMany({
      where
    });

    res.json({
      message: `Successfully deleted ${result.count} device token(s)`,
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Error deleting device tokens:', error);
    res.status(500).json({ error: 'Failed to delete device tokens' });
  }
};

/**
 * Get device token statistics for current user
 * GET /api/device-tokens/stats
 */
const getDeviceTokenStats = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [totalTokens, iosTokens, androidTokens] = await Promise.all([
      req.prisma.deviceToken.count({
        where: { userId }
      }),
      req.prisma.deviceToken.count({
        where: { userId, platform: 'ios' }
      }),
      req.prisma.deviceToken.count({
        where: { userId, platform: 'android' }
      })
    ]);

    const unknownPlatformTokens = totalTokens - iosTokens - androidTokens;

    res.json({
      total: totalTokens,
      platforms: {
        ios: iosTokens,
        android: androidTokens,
        unknown: unknownPlatformTokens
      }
    });
  } catch (error) {
    console.error('Error fetching device token stats:', error);
    res.status(500).json({ error: 'Failed to fetch device token statistics' });
  }
};

/**
 * Validate device token (check if it exists and is active)
 * POST /api/device-tokens/validate
 */
const validateDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const deviceToken = await req.prisma.deviceToken.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        platform: true,
        createdAt: true
      }
    });

    if (!deviceToken) {
      return res.json({
        valid: false,
        message: 'Token not found'
      });
    }

    if (deviceToken.userId !== userId) {
      return res.json({
        valid: false,
        message: 'Token belongs to different user'
      });
    }

    res.json({
      valid: true,
      message: 'Token is valid',
      deviceToken
    });
  } catch (error) {
    console.error('Error validating device token:', error);
    res.status(500).json({ error: 'Failed to validate device token' });
  }
};

/**
 * Bulk register device tokens
 * POST /api/device-tokens/bulk
 */
const bulkRegisterDeviceTokens = async (req, res) => {
  try {
    const { tokens } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ error: 'Tokens array is required' });
    }

    if (tokens.length > 10) {
      return res.status(400).json({ error: 'Cannot register more than 10 tokens at once' });
    }

    // Validate token objects
    for (const tokenObj of tokens) {
      if (!tokenObj.token) {
        return res.status(400).json({ error: 'Each token object must have a token field' });
      }
      if (tokenObj.platform && !['ios', 'android'].includes(tokenObj.platform)) {
        return res.status(400).json({ error: 'Platform must be either "ios" or "android"' });
      }
    }

    const results = {
      created: [],
      updated: [],
      errors: []
    };

    // Process each token
    for (const tokenObj of tokens) {
      try {
        const existingToken = await req.prisma.deviceToken.findUnique({
          where: { token: tokenObj.token }
        });

        if (existingToken) {
          if (existingToken.userId !== userId) {
            // Update to new user
            const updated = await req.prisma.deviceToken.update({
              where: { token: tokenObj.token },
              data: {
                userId,
                platform: tokenObj.platform || existingToken.platform
              }
            });
            results.updated.push(updated);
          } else if (tokenObj.platform && existingToken.platform !== tokenObj.platform) {
            // Update platform
            const updated = await req.prisma.deviceToken.update({
              where: { token: tokenObj.token },
              data: { platform: tokenObj.platform }
            });
            results.updated.push(updated);
          }
        } else {
          // Create new token
          const created = await req.prisma.deviceToken.create({
            data: {
              token: tokenObj.token,
              userId,
              platform: tokenObj.platform
            }
          });
          results.created.push(created);
        }
      } catch (error) {
        results.errors.push({
          token: tokenObj.token,
          error: error.message
        });
      }
    }

    res.status(201).json({
      message: 'Bulk registration completed',
      results: {
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length
      },
      details: results
    });
  } catch (error) {
    console.error('Error bulk registering device tokens:', error);
    res.status(500).json({ error: 'Failed to bulk register device tokens' });
  }
};

module.exports = {
  registerDeviceToken,
  getUserDeviceTokens,
  getDeviceTokenById,
  updateDeviceToken,
  deleteDeviceToken,
  deleteDeviceTokenByValue,
  deleteAllUserDeviceTokens,
  getDeviceTokenStats,
  validateDeviceToken,
  bulkRegisterDeviceTokens
};