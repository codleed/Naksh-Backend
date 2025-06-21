const express = require('express');
const { requireAuth, syncUser, checkSuspension } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, uploadMixed, handleUploadError } = require('../middleware/upload');
const { uploadFile, deleteFile, getOptimizedUrl, getVideoThumbnail, extractPublicId } = require('../config/cloudinary');
const router = express.Router();

// POST /api/media/avatar - Upload user avatar
router.post('/avatar', 
  requireAuth, 
  syncUser, 
  checkSuspension,
  ...uploadSingle('avatar', 'avatar'),
  async (req, res) => {
    try {
      const userId = req.auth.userId;
      
      // Convert buffer to base64 for Cloudinary upload
      const fileBuffer = req.file.buffer;
      const base64File = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
      
      // Upload to Cloudinary
      const uploadResult = await uploadFile(base64File, 'avatar', {
        public_id: `avatar_${userId}_${Date.now()}`,
      });

      if (!uploadResult.success) {
        return res.status(500).json({ error: uploadResult.error });
      }

      // Update user avatar in database
      const user = await req.prisma.user.update({
        where: { clerkId: userId },
        data: { avatarUrl: uploadResult.url },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true
        }
      });

      res.json({
        message: 'Avatar uploaded successfully',
        user,
        media: {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes
        }
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

// POST /api/media/post - Upload media for posts
router.post('/post',
  requireAuth,
  syncUser,
  checkSuspension,
  ...uploadMixed('media', 10),
  async (req, res) => {
    try {
      const userId = req.auth.userId;
      const uploadedMedia = [];

      // Upload each file to Cloudinary
      for (const file of req.files) {
        const fileBuffer = file.buffer;
        const base64File = `data:${file.mimetype};base64,${fileBuffer.toString('base64')}`;
        
        const uploadResult = await uploadFile(base64File, file.uploadType, {
          public_id: `post_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });

        if (uploadResult.success) {
          uploadedMedia.push({
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            type: file.uploadType === 'post_video' ? 'VIDEO' : 'IMAGE',
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
            bytes: uploadResult.bytes,
            duration: uploadResult.duration,
            originalName: file.originalname,
            thumbnailUrl: file.uploadType === 'post_video' 
              ? getVideoThumbnail(uploadResult.publicId)
              : null
          });
        } else {
          console.error(`Failed to upload ${file.originalname}:`, uploadResult.error);
        }
      }

      if (uploadedMedia.length === 0) {
        return res.status(500).json({ error: 'Failed to upload any media files' });
      }

      res.json({
        message: `Successfully uploaded ${uploadedMedia.length} media file(s)`,
        media: uploadedMedia,
        totalUploaded: uploadedMedia.length,
        totalRequested: req.files.length
      });
    } catch (error) {
      console.error('Error uploading post media:', error);
      res.status(500).json({ error: 'Failed to upload media' });
    }
  }
);

// POST /api/media/chat - Upload media for chat messages
router.post('/chat',
  requireAuth,
  syncUser,
  checkSuspension,
  ...uploadSingle('media', 'chat_media'),
  async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { chatId } = req.body;

      if (!chatId) {
        return res.status(400).json({ error: 'Chat ID is required' });
      }

      // Verify user is member of the chat
      const chatMember = await req.prisma.chatMember.findUnique({
        where: {
          memberId_chatId: {
            memberId: userId,
            chatId
          }
        }
      });

      if (!chatMember) {
        return res.status(403).json({ error: 'Access denied to this chat' });
      }

      // Upload to Cloudinary
      const fileBuffer = req.file.buffer;
      const base64File = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
      
      const uploadResult = await uploadFile(base64File, 'chat_media', {
        public_id: `chat_${chatId}_${userId}_${Date.now()}`,
      });

      if (!uploadResult.success) {
        return res.status(500).json({ error: uploadResult.error });
      }

      const isVideo = uploadResult.resourceType === 'video';

      res.json({
        message: 'Chat media uploaded successfully',
        media: {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          type: isVideo ? 'VIDEO' : 'IMAGE',
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          duration: uploadResult.duration,
          thumbnailUrl: isVideo ? getVideoThumbnail(uploadResult.publicId) : null
        }
      });
    } catch (error) {
      console.error('Error uploading chat media:', error);
      res.status(500).json({ error: 'Failed to upload chat media' });
    }
  }
);

// DELETE /api/media/:publicId - Delete media from Cloudinary
router.delete('/:publicId',
  requireAuth,
  syncUser,
  checkSuspension,
  async (req, res) => {
    try {
      const { publicId } = req.params;
      const { resourceType = 'image' } = req.query;
      const userId = req.auth.userId;

      // Verify the media belongs to the user (basic check)
      if (!publicId.includes(userId)) {
        return res.status(403).json({ error: 'Access denied to this media' });
      }

      const deleteResult = await deleteFile(publicId, resourceType);

      if (!deleteResult.success) {
        return res.status(500).json({ error: deleteResult.error });
      }

      res.json({
        message: 'Media deleted successfully',
        publicId,
        result: deleteResult.result
      });
    } catch (error) {
      console.error('Error deleting media:', error);
      res.status(500).json({ error: 'Failed to delete media' });
    }
  }
);

// GET /api/media/optimize - Get optimized URL for existing media
router.get('/optimize', async (req, res) => {
  try {
    const { url, width, height, quality = 'auto', format = 'auto' } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const publicId = extractPublicId(url);
    if (!publicId) {
      return res.status(400).json({ error: 'Invalid Cloudinary URL' });
    }

    const transformations = {
      quality,
      fetch_format: format,
    };

    if (width || height) {
      transformations.width = width;
      transformations.height = height;
      transformations.crop = 'limit';
    }

    const optimizedUrl = getOptimizedUrl(publicId, transformations);

    res.json({
      originalUrl: url,
      optimizedUrl,
      transformations
    });
  } catch (error) {
    console.error('Error generating optimized URL:', error);
    res.status(500).json({ error: 'Failed to generate optimized URL' });
  }
});

// GET /api/media/thumbnail - Get video thumbnail
router.get('/thumbnail', async (req, res) => {
  try {
    const { url, width = 300, height = 300 } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const publicId = extractPublicId(url);
    if (!publicId) {
      return res.status(400).json({ error: 'Invalid Cloudinary URL' });
    }

    const thumbnailUrl = getVideoThumbnail(publicId, {
      transformation: [
        { width: parseInt(width), height: parseInt(height), crop: 'fill' }
      ]
    });

    res.json({
      videoUrl: url,
      thumbnailUrl,
      width: parseInt(width),
      height: parseInt(height)
    });
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// GET /api/media/info/:publicId - Get media information
router.get('/info/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    const { resourceType = 'image' } = req.query;

    // Get resource info from Cloudinary
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType
    });

    res.json({
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      duration: result.duration,
      createdAt: result.created_at,
      resourceType: result.resource_type
    });
  } catch (error) {
    console.error('Error fetching media info:', error);
    res.status(500).json({ error: 'Failed to fetch media information' });
  }
});

// Error handling middleware
router.use(handleUploadError);

module.exports = router;