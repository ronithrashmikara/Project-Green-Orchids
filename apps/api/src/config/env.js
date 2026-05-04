const path = require('path');

// Load .env files in order: .env.{NODE_ENV}.local, .env.{NODE_ENV}, .env.local, .env
const envFiles = [];
const nodeEnv = process.env.NODE_ENV || 'development';

[
  `.env.${nodeEnv}.local`,
  `.env.${nodeEnv}`,
  '.env.local',
  '.env'
].forEach(f => {
  try { require('dotenv').config({ path: path.resolve(__dirname, '../../', f) }); } catch (_) {}
});

const env = {
  NODE_ENV: nodeEnv,
  PORT: parseInt(process.env.PORT, 10) || 5000,

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@korchids.com',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  CLOUDINARY_URL: process.env.CLOUDINARY_URL,
  CLOUD_NAME: process.env.CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  PAYHERE_MERCHANT_ID: process.env.PAYHERE_MERCHANT_ID,
  PAYHERE_SECRET: process.env.PAYHERE_SECRET,

  EMAIL_ALLOWLIST: process.env.EMAIL_ALLOWLIST ? process.env.EMAIL_ALLOWLIST.split(',').map(s => s.trim()) : null,
  ENABLE_CRON: String(process.env.ENABLE_CRON || '').toLowerCase() === 'true',

  isDev: nodeEnv === 'development',
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
};

// Validate required vars
const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter(k => !env[k]);
if (missing.length) {
  console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = env;
