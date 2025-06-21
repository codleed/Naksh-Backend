const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload options for different media types
const uploadOptions = {
  // Profile avatars
  avatar: {
    folder: 'naksh/avatars',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_file_size: 5000000, // 5MB
  },

  // Post images
  post_image: {
    folder: 'naksh/posts/images',
    transformation: [
      { width: 1080, height: 1080, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    max_file_size: 10000000, // 10MB
  },

  // Post videos
  post_video: {
    folder: 'naksh/posts/videos',
    resource_type: 'video',
    transformation: [
      { width: 1080, height: 1920, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
    max_file_size: 100000000, // 100MB
  },

  // Chat media
  chat_media: {
    folder: 'naksh/chats',
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'],
    max_file_size: 50000000, // 50MB
  }
};

/**
 * Upload file to Cloudinary
 * @param {Buffer|string} file - File buffer or file path
 * @param {string} type - Upload type (avatar, post_image, post_video, chat_media)
 * @param {object} options - Additional upload options
 * @returns {Promise<object>} Upload result
 */
const uploadFile = async (file, type = 'post_image', options = {}) => {
  try {
    const uploadConfig = {
      ...uploadOptions[type],
      ...options,
      use_filename: true,
      unique_filename: true,
    };

    const result = await cloudinary.uploader.upload(file, uploadConfig);
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      duration: result.duration || null, // For videos
      resourceType: result.resource_type,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<object>} Deletion result
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    
    return {
      success: result.result === 'ok',
      result: result.result,
    };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Generate optimized URL for different use cases
 * @param {string} publicId - Cloudinary public ID
 * @param {object} transformations - Transformation options
 * @returns {string} Optimized URL
 */
const getOptimizedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    ...transformations,
  });
};

/**
 * Generate thumbnail URL for videos
 * @param {string} publicId - Video public ID
 * @param {object} options - Thumbnail options
 * @returns {string} Thumbnail URL
 */
const getVideoThumbnail = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      { width: 300, height: 300, crop: 'fill' },
      { quality: 'auto' }
    ],
    ...options,
  });
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID
 */
const extractPublicId = (url) => {
  try {
    const regex = /\/(?:v\d+\/)?([^\.]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

/**
 * Validate file type and size
 * @param {object} file - File object from multer
 * @param {string} type - Upload type
 * @returns {object} Validation result
 */
const validateFile = (file, type) => {
  const config = uploadOptions[type];
  
  if (!config) {
    return { valid: false, error: 'Invalid upload type' };
  }

  // Check file size
  if (file.size > config.max_file_size) {
    return { 
      valid: false, 
      error: `File size exceeds limit of ${config.max_file_size / 1000000}MB` 
    };
  }

  // Check file format
  const fileExtension = file.originalname.split('.').pop().toLowerCase();
  if (!config.allowed_formats.includes(fileExtension)) {
    return { 
      valid: false, 
      error: `File format not allowed. Allowed formats: ${config.allowed_formats.join(', ')}` 
    };
  }

  return { valid: true };
};

module.exports = {
  cloudinary,
  uploadFile,
  deleteFile,
  getOptimizedUrl,
  getVideoThumbnail,
  extractPublicId,
  validateFile,
  uploadOptions,
};