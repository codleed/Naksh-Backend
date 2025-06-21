const multer = require('multer');
const { validateFile } = require('../config/cloudinary');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allow all files, validation will be done later based on upload type
  cb(null, true);
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 10, // Max 10 files per request
  },
});

// Middleware for single file upload
const uploadSingle = (fieldName = 'file', uploadType = 'post_image') => {
  return [
    upload.single(fieldName),
    (req, res, next) => {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file
      const validation = validateFile(req.file, uploadType);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      req.uploadType = uploadType;
      next();
    }
  ];
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName = 'files', maxCount = 10, uploadType = 'post_image') => {
  return [
    upload.array(fieldName, maxCount),
    (req, res, next) => {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Validate all files
      for (const file of req.files) {
        const validation = validateFile(file, uploadType);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: `File ${file.originalname}: ${validation.error}` 
          });
        }
      }

      req.uploadType = uploadType;
      next();
    }
  ];
};

// Middleware for mixed media upload (images and videos)
const uploadMixed = (fieldName = 'media', maxCount = 10) => {
  return [
    upload.array(fieldName, maxCount),
    (req, res, next) => {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Validate files and determine upload type for each
      const validatedFiles = [];
      
      for (const file of req.files) {
        const fileExtension = file.originalname.split('.').pop().toLowerCase();
        const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(fileExtension);
        const uploadType = isVideo ? 'post_video' : 'post_image';
        
        const validation = validateFile(file, uploadType);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: `File ${file.originalname}: ${validation.error}` 
          });
        }

        validatedFiles.push({
          ...file,
          uploadType
        });
      }

      req.files = validatedFiles;
      next();
    }
  ];
};

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ error: 'File too large' });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ error: 'Too many files' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ error: 'Unexpected file field' });
      default:
        return res.status(400).json({ error: 'Upload error: ' + error.message });
    }
  }
  next(error);
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadMixed,
  handleUploadError,
};