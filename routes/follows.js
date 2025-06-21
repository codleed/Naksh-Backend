const express = require('express');
const router = express.Router();

// GET /api/follows - Get follows with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      followerId,
      followeeId 
    } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(followerId && { followerId }),
      ...(followeeId && { followeeId })
    };

    const follows = await req.prisma.follow.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        followee: {
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

    const total = await req.prisma.follow.count({ where });

    res.json({
      follows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching follows:', error);
    res.status(500).json({ error: 'Failed to fetch follows' });
  }
});

// POST /api/follows - Follow a user
router.post('/', async (req, res) => {
  try {
    const { followerId, followeeId } = req.body;

    if (!followerId || !followeeId) {
      return res.status(400).json({ 
        error: 'Follower ID and followee ID are required' 
      });
    }

    if (followerId === followeeId) {
      return res.status(400).json({ 
        error: 'Users cannot follow themselves' 
      });
    }

    // Check if both users exist
    const [follower, followee] = await Promise.all([
      req.prisma.user.findUnique({
        where: { id: followerId },
        select: { id: true, username: true }
      }),
      req.prisma.user.findUnique({
        where: { id: followeeId },
        select: { id: true, username: true }
      })
    ]);

    if (!follower) {
      return res.status(404).json({ error: 'Follower user not found' });
    }

    if (!followee) {
      return res.status(404).json({ error: 'Followee user not found' });
    }

    // Check if already following
    const existingFollow = await req.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId
        }
      }
    });

    if (existingFollow) {
      return res.status(409).json({ error: 'Already following this user' });
    }

    const follow = await req.prisma.follow.create({
      data: {
        followerId,
        followeeId
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        },
        followee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json(follow);
  } catch (error) {
    console.error('Error creating follow:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// DELETE /api/follows - Unfollow a user
router.delete('/', async (req, res) => {
  try {
    const { followerId, followeeId } = req.body;

    if (!followerId || !followeeId) {
      return res.status(400).json({ 
        error: 'Follower ID and followee ID are required' 
      });
    }

    await req.prisma.follow.delete({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Follow relationship not found' });
    }
    console.error('Error deleting follow:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// GET /api/follows/followers/:userId - Get followers of a user
router.get('/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      followeeId: userId,
      ...(search && {
        follower: {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } }
          ]
        }
      })
    };

    const followers = await req.prisma.follow.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            _count: {
              select: {
                followers: true,
                following: true,
                posts: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.follow.count({ where });

    res.json({
      followers: followers.map(f => ({
        ...f.follower,
        followedAt: f.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// GET /api/follows/following/:userId - Get users that a user is following
router.get('/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      followerId: userId,
      ...(search && {
        followee: {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } }
          ]
        }
      })
    };

    const following = await req.prisma.follow.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        followee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            _count: {
              select: {
                followers: true,
                following: true,
                posts: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await req.prisma.follow.count({ where });

    res.json({
      following: following.map(f => ({
        ...f.followee,
        followedAt: f.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// GET /api/follows/check - Check if user A follows user B
router.get('/check', async (req, res) => {
  try {
    const { followerId, followeeId } = req.query;

    if (!followerId || !followeeId) {
      return res.status(400).json({ 
        error: 'Follower ID and followee ID are required' 
      });
    }

    const follow = await req.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId
        }
      },
      select: {
        createdAt: true
      }
    });

    res.json({
      isFollowing: !!follow,
      followedAt: follow?.createdAt || null
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// GET /api/follows/mutual/:userId1/:userId2 - Check mutual following
router.get('/mutual/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    const [user1FollowsUser2, user2FollowsUser1] = await Promise.all([
      req.prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: userId1,
            followeeId: userId2
          }
        }
      }),
      req.prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: userId2,
            followeeId: userId1
          }
        }
      })
    ]);

    res.json({
      user1FollowsUser2: !!user1FollowsUser2,
      user2FollowsUser1: !!user2FollowsUser1,
      mutualFollow: !!user1FollowsUser2 && !!user2FollowsUser1
    });
  } catch (error) {
    console.error('Error checking mutual follow:', error);
    res.status(500).json({ error: 'Failed to check mutual follow' });
  }
});

// GET /api/follows/stats/:userId - Get follow statistics for a user
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [followersCount, followingCount] = await Promise.all([
      req.prisma.follow.count({
        where: { followeeId: userId }
      }),
      req.prisma.follow.count({
        where: { followerId: userId }
      })
    ]);

    res.json({
      followers: followersCount,
      following: followingCount
    });
  } catch (error) {
    console.error('Error fetching follow stats:', error);
    res.status(500).json({ error: 'Failed to fetch follow stats' });
  }
});

// GET /api/follows/suggestions/:userId - Get follow suggestions for a user
router.get('/suggestions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    // Get users that the current user's followers are following
    // but the current user is not following (friends of friends)
    const suggestions = await req.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } }, // Not the current user
          {
            followers: {
              some: {
                follower: {
                  followers: {
                    some: { followeeId: userId }
                  }
                }
              }
            }
          },
          {
            followers: {
              none: { followerId: userId }
            }
          }
        ]
      },
      take: parseInt(limit),
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        _count: {
          select: {
            followers: true,
            posts: true
          }
        }
      },
      orderBy: {
        followers: {
          _count: 'desc'
        }
      }
    });

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching follow suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch follow suggestions' });
  }
});

module.exports = router;