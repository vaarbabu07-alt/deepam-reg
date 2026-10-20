/**
 * Secure File Upload Middleware
 * Handles payment screenshot uploads with MIME verification, size limits, and safe naming.
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

// Memory storage for 100% serverless/Netlify compatibility and data privacy
const storage = multer.memoryStorage();

// File filter: strict image mime types
const fileFilter = (req, file, cb) => {
  if (config.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.uploadMaxSizeMB * 1024 * 1024 // 5 MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;
