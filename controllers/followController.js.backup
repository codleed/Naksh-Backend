/**
 * Follow Controller
 * Handles all follow/unfollow operations and related functionality
 */

/**
 * Follow a user
 * POST /api/users/:userId/follow
 */
const followUser = async (req, res) => {
  try {
    const { userId } = req.params; // User to follow (followee)
    const followerId = req.user?.id; // Current user (follower)

    if (!followerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Prevent self-following
    if (followerId === userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if the user to follow exists
    const userToFollow = await req.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true
      }
    });

    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existingFollow = await req.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId: userId
        }
      }
    });

    if (existingFollow) {
      return res.status(409).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    const follow = await req.prisma.follow.create({
      data: {
        followerId,
        followeeId: userId
      },
      include: {
        followee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            _count: {
              select: {
                followers: true,
                following: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      message: 'Successfully followed user',
      follow,
      followedUser: follow.followee
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
};

/**
 * Unfollow a user
 * DELETE /api/users/:userId/follow
 */
const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params; // User to unfollow (followee)
    const followerId = req.user?.id; // Current user (follower)

    if (!followerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if follow relationship exists
    const existingFollow = await req.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId: userId
        }
      }
    });

    if (!existingFollow) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    // Remove follow relationship
    await req.prisma.follow.delete({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId: userId
        }
      }
    });

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
};

/**
 * Get user's followers
 * GET /api/users/:userId/followers
 */
const getUserFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build search filter
    const searchFilter = search ? {
      follower: {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } }
        ]
      }
    } : {};

    const followers = await req.prisma.follow.findMany({
      where: {
        followeeId: userId,
        ...searchFilter
      },
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
            isAnonymous: true,
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

    const total = await req.prisma.follow.count({
      where: {
        followeeId: userId,
        ...searchFilter
      }
    });

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
};

/**
 * Get user's following
 * GET /api/users/:userId/following
 */
const getUserFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await req.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build search filter
    const searchFilter = search ? {
      followee: {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } }
        ]
      }
    } : {};

    const following = await req.prisma.follow.findMany({
      where: {
        followerId: userId,
        ...searchFilter
      },
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
            isAnonymous: true,
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

    const total = await req.prisma.follow.count({
      where: {
        followerId: userId,
        ...searchFilter
      }
    });

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
};

/**
 * Check if current user follows a specific user
 * GET /api/users/:userId/follow/status
 */
const getFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params; // User to check
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if current user follows the specified user
    const isFollowing = await req.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId: currentUserId,
          followeeId: userId
        }
      }
    });

    // Check if the specified user follows current user back
    const isFollowedBy = await req.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId: userId,
          followeeId: currentUserId
        }
      }
    });

    res.json({
      isFollowing: !!isFollowing,
      isFollowedBy: !!isFollowedBy,
      isMutual: !!isFollowing && !!isFollowedBy,
      followedAt: isFollowing?.createdAt || null
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
};

/**
 * Get mutual followers between current user and another user
 * GET /api/users/:userId/mutual-followers
 */
const getMutualFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (currentUserId === userId) {
      return res.status(400).json({ error: 'Cannot get mutual followers with yourself' });
    }

    // Check if target user exists
    const targetUser = await req.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get users who follow both current user and target user
    const mutualFollowers = await req.prisma.user.findMany({
      where: {
        AND: [
          {
            following: {
              some: { followeeId: currentUserId }
            }
          },
          {
            following: {
              some: { followeeId: userId }
            }
          }
        ]
      },
      skip: parseInt(skip),
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
            following: true
          }
        }
      },
      orderBy: { username: 'asc' }
    });

    const total = await req.prisma.user.count({
      where: {
        AND: [
          {
            following: {
              some: { followeeId: currentUserId }
            }
          },
          {
            following: {
              some: { followeeId: userId }
            }
          }
        ]
      }
    });

    res.json({
      mutualFollowers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching mutual followers:', error);
    res.status(500).json({ error: 'Failed to fetch mutual followers' });
  }
};

/**
 * Get suggested users to follow
 * GET /api/users/suggestions
 */
const getSuggestedUsers = async (req, res) => {
  try {
    const currentUserId = req.user?.id;
    const { limit = 10 } = req.query;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get users that current user is not following
    // Prioritize users followed by people the current user follows
    const suggestions = await req.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } }, // Not the current user
          {
            followers: {
              none: { followerId: currentUserId } // Not already followed
            }
          }
        ]
      },
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
      },
      take: parseInt(limit),
      orderBy: [
        { followers: { _count: 'desc' } }, // Popular users first
        { createdAt: 'desc' } // Then recent users
      ]
    });

    // For each suggestion, check if they're followed by users the current user follows
    const suggestionsWithMutualInfo = await Promise.all(
      suggestions.map(async (user) => {
        const mutualFollowersCount = await req.prisma.user.count({
          where: {
            AND: [
              {
                following: {
                  some: { followeeId: currentUserId }
                }
              },
              {
                following: {
                  some: { followeeId: user.id }
                }
              }
            ]
          }
        });

        return {
          ...user,
          mutualFollowersCount
        };
      })
    );

    // Sort by mutual followers count (users followed by your followers first)
    suggestionsWithMutualInfo.sort((a, b) => b.mutualFollowersCount - a.mutualFollowersCount);

    res.json({
      suggestions: suggestionsWithMutualInfo
    });
  } catch (error) {
    console.error('Error fetching user suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch user suggestions' });
  }
};

/**
 * Bulk follow multiple users
 * POST /api/users/follow/bulk
 */
const bulkFollowUsers = async (req, res) => {
  try {
    const { userIds } = req.body;
    const followerId = req.user?.id;

    if (!followerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    if (userIds.length > 50) {
      return res.status(400).json({ error: 'Cannot follow more than 50 users at once' });
    }

    // Remove current user from the list and duplicates
    const validUserIds = [...new Set(userIds.filter(id => id !== followerId))];

    if (validUserIds.length === 0) {
      return res.status(400).json({ error: 'No valid users to follow' });
    }

    // Check which users exist
    const existingUsers = await req.prisma.user.findMany({
      where: { id: { in: validUserIds } },
      select: { id: true }
    });

    const existingUserIds = existingUsers.map(u => u.id);

    // Check which users are already being followed
    const existingFollows = await req.prisma.follow.findMany({
      where: {
        followerId,
        followeeId: { in: existingUserIds }
      },
      select: { followeeId: true }
    });

    const alreadyFollowedIds = existingFollows.map(f => f.followeeId);
    const usersToFollow = existingUserIds.filter(id => !alreadyFollowedIds.includes(id));

    if (usersToFollow.length === 0) {
      return res.status(409).json({ error: 'Already following all specified users' });
    }

    // Create follow relationships
    const followData = usersToFollow.map(userId => ({
      followerId,
      followeeId: userId
    }));

    await req.prisma.follow.createMany({
      data: followData
    });

    res.status(201).json({
      message: `Successfully followed ${usersToFollow.length} users`,
      followedCount: usersToFollow.length,
      skippedCount: validUserIds.length - usersToFollow.length,
      followedUsers: usersToFollow
    });
  } catch (error) {
    console.error('Error bulk following users:', error);
    res.status(500).json({ error: 'Failed to bulk follow users' });
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
  getFollowStatus,
  getMutualFollowers,
  getSuggestedUsers,
  bulkFollowUsers
};