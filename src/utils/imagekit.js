const ImageKit = require('imagekit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

// Local uploads directory configuration (Fallback for local dev)
const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

// Ensure local directory exists in non-production if fallback is needed
if (config.env !== 'production') {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Checks if ImageKit has been configured with real credentials.
 */
function isImageKitConfigured() {
  const pub = config.imagekit?.publicKey || process.env.IMAGEKIT_PUBLIC_KEY;
  const priv = config.imagekit?.privateKey || process.env.IMAGEKIT_PRIVATE_KEY;
  const url = config.imagekit?.urlEndpoint || process.env.IMAGEKIT_URL_ENDPOINT;

  return (
    pub &&
    priv &&
    url &&
    !pub.includes('mock') &&
    !priv.includes('mock') &&
    !url.includes('mock')
  );
}

/**
 * Initializes ImageKit SDK if configured.
 */
let imagekit = null;
if (isImageKitConfigured()) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
}

/**
 * Uploads file buffer to ImageKit (or falls back to local disk in dev).
 * 
 * @param {Buffer} fileBuffer - The file buffer from multer
 * @param {string} originalName - Original filename
 * @returns {Promise<{ url: string, fileId: string }>} Upload result containing URL and file ID
 */
async function uploadImage(fileBuffer, originalName) {
  if (imagekit) {
    try {
      logger.info({ originalName }, 'Uploading image to ImageKit...');
      const response = await imagekit.upload({
        file: fileBuffer,
        fileName: originalName,
        folder: '/menudot/menu-items',
      });
      logger.info({ fileId: response.fileId }, 'Image uploaded to ImageKit successfully');
      return {
        url: response.url,
        fileId: response.fileId,
      };
    } catch (error) {
      logger.error({ err: error }, 'ImageKit upload failed. Falling back to local upload.');
      if (config.env === 'production') throw error;
    }
  }

  // Fallback to local storage (Development/Test environments)
  logger.info({ originalName }, 'Saving image to local filesystem fallback...');
  const ext = path.extname(originalName) || '.png';
  const uniqueName = `${crypto.randomBytes(12).toString('hex')}${ext}`;
  const filePath = path.join(LOCAL_UPLOADS_DIR, uniqueName);

  try {
    fs.writeFileSync(filePath, fileBuffer);
    const localUrl = `http://localhost:${config.port}/uploads/${uniqueName}`;
    const localFileId = `local_${uniqueName}`;
    logger.info({ localUrl }, 'Image saved locally successfully');
    return {
      url: localUrl,
      fileId: localFileId,
    };
  } catch (error) {
    logger.error({ err: error }, 'Local file upload fallback failed');
    throw error;
  }
}

/**
 * Deletes an image from ImageKit (or from local disk if it was local fallback).
 * 
 * @param {string} fileId - The ImageKit file ID or local file ID
 */
async function deleteImage(fileId) {
  if (!fileId) return;

  if (fileId.startsWith('local_')) {
    // Delete local fallback file
    const filename = fileId.replace('local_', '');
    const filePath = path.join(LOCAL_UPLOADS_DIR, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info({ fileId }, 'Local media asset file deleted successfully');
      }
    } catch (error) {
      logger.error({ err: error, fileId }, 'Failed to delete local media asset file');
    }
    return;
  }

  if (imagekit) {
    try {
      logger.info({ fileId }, 'Deleting image from ImageKit...');
      await imagekit.deleteFile(fileId);
      logger.info({ fileId }, 'Image deleted from ImageKit successfully');
    } catch (error) {
      logger.error({ err: error, fileId }, 'Failed to delete image from ImageKit');
      // Do not crash execution on deletion errors
    }
  }
}

module.exports = {
  uploadImage,
  deleteImage,
};
