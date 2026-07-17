const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('./errors');

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const ALLOWED_SUBDIRECTORIES = new Set(['avatars', 'cms', 'pod', 'products']);

// Only these image types are ever accepted anywhere in the app (products, CMS media, POD
// photos). MIME type alone is client-supplied and trivially spoofed (Finding 007 — a
// "shell.php.jpg" sent with a fake image/jpeg Content-Type used to sail straight through), so
// this is cross-checked against both the file extension and the real magic bytes on disk.
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Minimal magic-byte signatures for the allowed image types — no need for the `file-type`
// package (not an existing dependency) for a fixed, small allowlist like this.
const SIGNATURES = [
  { ext: ['.jpg', '.jpeg'], bytes: [0xff, 0xd8, 0xff] },
  { ext: ['.png'], bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: ['.gif'], bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF87a / GIF89a
  // WEBP: 'RIFF'....'WEBP' - bytes 8-11 checked separately below
  { ext: ['.webp'], bytes: [0x52, 0x49, 0x46, 0x46] },
];

function matchesSignature(buffer, ext) {
  const candidates = SIGNATURES.filter((s) => s.ext.includes(ext));
  if (!candidates.length) return false;
  return candidates.some((sig) => {
    if (!buffer || buffer.length < sig.bytes.length) return false;
    const head = buffer.subarray(0, sig.bytes.length);
    if (!sig.bytes.every((b, i) => head[i] === b)) return false;
    if (ext === '.webp') {
      // RIFF....WEBP - confirm the WEBP marker at offset 8 too, not just the RIFF header,
      // since RIFF is a shared container format for other file types (e.g. .wav, .avi).
      if (buffer.length < 12) return false;
      return buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return true;
  });
}

function makeUploader(subdir) {
  if (!ALLOWED_SUBDIRECTORIES.has(subdir)) {
    throw new Error(`Unsupported upload directory: ${subdir}`);
  }
  const dest = path.resolve(UPLOADS_ROOT, subdir);
  if (!dest.startsWith(`${UPLOADS_ROOT}${path.sep}`)) {
    throw new Error('Upload directory escapes the configured root');
  }
  fs.mkdirSync(dest, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
  const uploader = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      // A plain Error here has no statusCode/isOperational, so the global
      // error handler falls through to a raw 500 (with a leaked stack trace
      // in dev). Use AppError so a bad file type is a clean 400.
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!file.mimetype.startsWith('image/')) {
        return cb(new AppError('INVALID_FILE_TYPE', 'Only image files are allowed', 400), false);
      }
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new AppError('INVALID_FILE_TYPE', `File extension ${ext || '(none)'} is not allowed`, 400), false);
      }
      cb(null, true);
    },
  });

  // Wrap each multer method so its own errors (LIMIT_FILE_SIZE, etc., which
  // are MulterError instances — also not AppErrors) are normalized too, and so the file's real
  // magic bytes are checked once it's actually on disk (MIME/extension can both be spoofed by
  // the client; the file's own header can't).
  return {
    single: (field) => (req, res, next) => uploader.single(field)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return next(new AppError('UPLOAD_ERROR', err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5MB)' : err.message, 400));
        }
        return next(err);
      }
      if (!req.file) return next();

      const ext = path.extname(req.file.originalname || '').toLowerCase();
      let head;
      try {
        const fd = fs.openSync(req.file.path, 'r');
        head = Buffer.alloc(16);
        fs.readSync(fd, head, 0, 16, 0);
        fs.closeSync(fd);
      } catch (readErr) {
        return next(readErr);
      }

      if (!matchesSignature(head, ext)) {
        fs.unlink(req.file.path, () => {});
        return next(new AppError('INVALID_FILE_TYPE', 'File content does not match an allowed image type', 400));
      }
      next();
    }),
  };
}

function publicUrl(subdir, filename) {
  return `/uploads/${subdir}/${filename}`;
}

module.exports = { makeUploader, publicUrl, UPLOADS_ROOT };
