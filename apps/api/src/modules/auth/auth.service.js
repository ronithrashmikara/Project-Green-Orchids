const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const env = require('../../config/env');
const { tx, query } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const authRepository = require('./auth.repository');

const BCRYPT_ROUNDS = 12;

function uiAccountStatus(status) {
  if (status === 'ACTIVE') return 'APPROVED';
  if (status === 'PENDING_APPROVAL') return 'AWAITING_APPROVAL';
  return status;
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role_id: user.roleId || user.role_id },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const authService = {
  async register({ email, password, name, business_name, business_reg_no, phone, address_line1, address_line2, city, district, postal_code, ip, userAgent }) {
    // Check if email already exists
    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new AppError('EMAIL_EXISTS', 'An account with this email already exists', 409);
    }

    // Check email allowlist if configured
    if (env.EMAIL_ALLOWLIST && !env.EMAIL_ALLOWLIST.includes(email.toLowerCase())) {
      throw new AppError('REGISTRATION_RESTRICTED', 'Registration is currently restricted', 403);
    }

    const passwordHash = await hashPassword(password);
    const verifyToken = uuidv4();

    const result = await tx(async (client) => {
      // Create user
      const user = await authRepository.createUser(client, {
        email: email.toLowerCase(),
        passwordHash,
        name,
      });

      // Create trade account
      await authRepository.createTradeAccount(client, {
        userId: user.id,
        businessName: business_name,
        businessRegNo: business_reg_no,
        phone,
        addressLine1: address_line1,
        addressLine2: address_line2,
        city,
        district,
        postalCode: postal_code,
      });

      // Create verification token (24h expiry)
      await authRepository.createEmailToken(client, {
        userId: user.id,
        token: verifyToken,
        type: 'EMAIL_VERIFY',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return user;
    });

    // Send verification email
    try {
      await sendMail({
        to: email,
        subject: 'Verify your email - ORCHIDS',
        template: 'verify_email',
        data: {
          name,
          verifyUrl: `${env.CORS_ORIGIN}/verify-email/${verifyToken}`,
        },
      });
    } catch (mailErr) {
      console.error('Failed to send verification email:', mailErr.message);
    }

    return { id: result.id, email: result.email, name: result.name };
  },

  async login({ email, password, ip, userAgent }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Check lockout: 5 failures in 15 min
    const recentFailures = await authRepository.countRecentFailures(user.id, 15);
    if (recentFailures >= 5) {
      await authRepository.recordLoginHistory(null, {
        userId: user.id, ip, userAgent, success: false, failureReason: 'ACCOUNT_LOCKED',
      });
      throw new AppError('ACCOUNT_LOCKED', 'Account temporarily locked. Try again in 15 minutes.', 429);
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await authRepository.recordLoginHistory(null, {
        userId: user.id, ip, userAgent, success: false, failureReason: 'INVALID_PASSWORD',
      });
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_INACTIVE', `Account is ${user.status.toLowerCase()}. ${user.status === 'PENDING' ? 'Please verify your email.' : ''}`, 403);
    }

    // Record successful login
    await authRepository.recordLoginHistory(null, {
      userId: user.id, ip, userAgent, success: true,
    });

    // Manage sessions - max 3 active sessions
    const activeSessionCount = await authRepository.countActiveSessions(user.id);
    let sessionToRemove = null;
    if (activeSessionCount >= 3) {
      await authRepository.removeOldestSession(null, user.id);
    }

    // Create refresh token + session
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);

    await authRepository.createSession(null, {
      userId: user.id,
      refreshTokenHash,
      deviceInfo: userAgent?.substring(0, 200) || 'Unknown',
      ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Generate access token
    const permissions = await authRepository.getPermissions(user.id);
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      roleId: user.role_id,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleId: user.role_id,
        status: user.trade_account_status ? uiAccountStatus(user.trade_account_status) : user.status,
        tier: user.tier,
        businessName: user.business_name,
        permissions,
      },
    };
  },

  async refreshToken(oldRefreshToken) {
    const oldHash = hashToken(oldRefreshToken);
    const session = await authRepository.findSessionByRefreshToken(oldHash);

    if (!session) {
      // Token not found - possible reuse attack, revoke all sessions
      throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid refresh token', 401);
    }

    const user = await authRepository.findUserById(session.user_id);
    const permissions = await authRepository.getPermissions(session.user_id);
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      roleId: user.role_id,
    });

    // Create new refresh token
    const newRefreshToken = generateRefreshToken();
    const newHash = hashToken(newRefreshToken);

    // Revoke old and create new in one transaction
    await tx(async (client) => {
      await authRepository.revokeSession(client, session.id);
      await authRepository.createSession(client, {
        userId: session.user_id,
        refreshTokenHash: newHash,
        deviceInfo: session.device_info,
        ip: session.ip_address,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleId: user.role_id,
        status: user.trade_account_status ? uiAccountStatus(user.trade_account_status) : user.status,
        tier: user.tier,
        businessName: user.business_name,
        permissions,
      },
    };
  },

  async logout(refreshToken) {
    if (!refreshToken) return;
    const hash = hashToken(refreshToken);
    const session = await authRepository.findSessionByRefreshToken(hash);
    if (session) {
      await authRepository.revokeSession(null, session.id);
    }
  },

  async verifyEmail(token) {
    const emailToken = await authRepository.findEmailToken(token, 'EMAIL_VERIFY');
    if (!emailToken) {
      throw new AppError('INVALID_TOKEN', 'Invalid or expired verification token', 400);
    }

    await tx(async (client) => {
      await authRepository.verifyUserEmail(client, emailToken.user_id);
      await authRepository.markTokenUsed(client, emailToken.id);
    });
  },

  async forgotPassword({ email }) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If an account exists, a reset link has been sent.' };
    }

    const resetToken = uuidv4();
    await authRepository.createEmailToken(null, {
      userId: user.id,
      token: resetToken,
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    try {
      await sendMail({
        to: email,
        subject: 'Reset your password - ORCHIDS',
        template: 'reset_password',
        data: {
          name: user.name,
          resetUrl: `${env.CORS_ORIGIN}/reset-password/${resetToken}`,
        },
      });
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr.message);
    }

    return { message: 'If an account exists, a reset link has been sent.' };
  },

  async resetPassword(token, newPassword) {
    const emailToken = await authRepository.findEmailToken(token, 'PASSWORD_RESET');
    if (!emailToken) {
      throw new AppError('INVALID_TOKEN', 'Invalid or expired reset token', 400);
    }

    const passwordHash = await hashPassword(newPassword);

    await tx(async (client) => {
      await authRepository.updateUserPassword(client, emailToken.user_id, passwordHash);
      await authRepository.revokeAllUserSessions(client, emailToken.user_id);
      await authRepository.markTokenUsed(client, emailToken.id);
    });

    try {
      const user = await authRepository.findUserById(emailToken.user_id);
      await sendMail({
        to: user.email,
        subject: 'Password Changed - ORCHIDS',
        template: 'password_changed',
        data: { name: user.name, changedAt: new Date().toISOString() },
      });
    } catch (_) {}
  },

  async getMe(userId) {
    const profile = await authRepository.getUserWithProfile(userId);
    if (!profile) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    const permissions = await authRepository.getPermissions(userId);
    return { ...profile, permissions };
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);

    const userFull = await authRepository.findUserByEmail(user.email);
    const valid = await verifyPassword(currentPassword, userFull.password_hash);
    if (!valid) {
      throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await tx(async (client) => {
      await authRepository.updateUserPassword(client, userId, passwordHash);
      await authRepository.revokeAllUserSessions(client, userId);
    });
  },

  async updateProfile(userId, updates) {
    const userUpdates = {};
    const tradeUpdates = {};
    const userFields = ['name', 'phone'];
    const tradeFields = ['business_name', 'address_line1', 'address_line2', 'city', 'district', 'postal_code'];

    for (const [k, v] of Object.entries(updates)) {
      if (userFields.includes(k)) userUpdates[k] = v;
      if (tradeFields.includes(k)) tradeUpdates[k] = v;
    }

    if (Object.keys(userUpdates).length) {
      await authRepository.updateUserProfile(userId, userUpdates);
    }
    if (Object.keys(tradeUpdates).length) {
      await authRepository.updateTradeAccountProfile(userId, tradeUpdates);
    }

    return authRepository.getUserWithProfile(userId);
  },

  async getSessions(userId) {
    return authRepository.getActiveSessions(userId);
  },

  async revokeSession(userId, sessionId) {
    const result = await authRepository.revokeSessionById(userId, sessionId);
    if (!result) throw new AppError('NOT_FOUND', 'Session not found', 404);
  },

  async getSummary(userId) {
    return authRepository.getUserSummary(userId);
  },
};

module.exports = authService;
