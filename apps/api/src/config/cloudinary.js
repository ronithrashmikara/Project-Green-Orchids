const crypto = require('crypto');
const env = require('./env');

/**
 * Cloudinary configuration placeholder.
 * In production, use the cloudinary npm package for proper setup.
 */

function getConfig() {
  return {
    cloudName: env.CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    url: env.CLOUDINARY_URL,
  };
}

/**
 * Generate a signed URL for authenticated resource access
 */
function generateSignedUrl(publicId, options = {}) {
  const config = getConfig();
  if (!config.apiSecret) {
    return `https://res.cloudinary.com/${config.cloudName || 'demo'}/image/upload/${publicId}`;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const transformation = options.transformation || '';
  const toSign = `upload/${publicId}${timestamp}${config.apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  return `https://res.cloudinary.com/${config.cloudName}/image/upload/${signature}/${publicId}`;
}

/**
 * Build responsive image URL
 */
function imageUrl(publicId, options = {}) {
  const config = getConfig();
  const cloud = config.cloudName || 'demo';
  const width = options.width ? `w_${options.width}` : '';
  const height = options.height ? `h_${options.height}` : '';
  const crop = options.crop || 'fit';
  const quality = options.quality || 'auto';
  const format = options.format || 'auto';
  const transformations = [width, height, `c_${crop}`, `q_${quality}`, `f_${format}`].filter(Boolean).join(',');

  const path = transformations ? `${transformations}/${publicId}` : publicId;
  return `https://res.cloudinary.com/${cloud}/image/upload/${path}`;
}

module.exports = { getConfig, generateSignedUrl, imageUrl };
