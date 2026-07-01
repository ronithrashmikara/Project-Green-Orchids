const { Router } = require('express');
const ctrl = require('./auth.controller');
const { validate } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/auth');
const { authLimiter, forgotPasswordLimiter } = require('../../middleware/rateLimit');
const {
  registerSchema, loginSchema, forgotPasswordSchema,
  resetPasswordSchema, changePasswordSchema, updateProfileSchema,
  verifyOtpSchema, resendOtpSchema,
} = require('./auth.schema');

const router = Router();

function normalizeRegisterBody(req, _res, next) {
  const body = req.body || {};
  if (body.businessName || body.businessRegNo || body.registrationNo || body.address) {
    req.body = {
      email: body.email,
      password: body.password,
      name: body.name || body.contactName || body.ownerName || body.businessName,
      business_name: body.business_name || body.businessName,
      business_reg_no: body.business_reg_no || body.businessRegNo || body.registrationNo,
      phone: body.phone,
      address_line1: body.address_line1 || body.addressLine1 || body.address || 'Not provided',
      address_line2: body.address_line2 || body.addressLine2,
      city: body.city || 'Colombo',
      district: body.district,
      postal_code: body.postal_code || body.postalCode,
    };
  }
  next();
}

// Public routes with rate limiting
router.post('/register', authLimiter, normalizeRegisterBody, validate({ body: registerSchema }), ctrl.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.post('/verify-email', authLimiter, validate({ body: verifyOtpSchema }), ctrl.verifyEmail);
router.post('/verify-email/resend', authLimiter, validate({ body: resendOtpSchema }), ctrl.resendVerification);
router.post('/forgot-password', forgotPasswordLimiter, validate({ body: forgotPasswordSchema }), ctrl.forgotPassword);
router.post('/reset-password/:token', validate({ body: resetPasswordSchema }), ctrl.resetPassword);

// Protected routes
router.get('/me', requireAuth, ctrl.getMe);
router.get('/me/summary', requireAuth, ctrl.getSummary);
router.get('/me/sessions', requireAuth, ctrl.getSessions);
router.delete('/me/sessions/:id', requireAuth, ctrl.revokeSession);
router.post('/me/sessions/revoke-others', requireAuth, ctrl.signOutOtherSessions);
router.patch('/me/profile', requireAuth, validate({ body: updateProfileSchema }), ctrl.updateProfile);
router.post('/me/change-password', requireAuth, validate({ body: changePasswordSchema }), ctrl.changePassword);

module.exports = router;
