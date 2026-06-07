const authService = require('./auth.service');

const authController = {
  async register(req, res, next) {
    try {
      const result = await authService.register({
        ...req.body,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login({
        ...req.body,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Set refresh token as httpOnly cookie
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user,
        data: {
          accessToken: result.accessToken,
          user: result.user,
        },
      });
    } catch (err) { next(err); }
  },

  async refresh(req, res, next) {
    try {
      const oldRefreshToken = req.cookies?.refresh_token || req.cookies?.refreshToken;
      if (!oldRefreshToken) {
        return res.status(401).json({
          success: false,
          error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token not provided' },
        });
      }

      const result = await authService.refreshToken(oldRefreshToken);

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user,
        data: { accessToken: result.accessToken, user: result.user },
      });
    } catch (err) { next(err); }
  },

  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies?.refresh_token || req.cookies?.refreshToken;
      await authService.logout(refreshToken);
      res.clearCookie('refresh_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/api/auth' });
      res.clearCookie('refreshToken', { path: '/' });
      res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (err) { next(err); }
  },

  async verifyEmail(req, res, next) {
    try {
      await authService.verifyEmail(req.params.token);
      res.json({ success: true, data: { message: 'Email verified successfully' } });
    } catch (err) { next(err); }
  },

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.body);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async resetPassword(req, res, next) {
    try {
      await authService.resetPassword(req.params.token, req.body.password);
      res.json({ success: true, data: { message: 'Password reset successfully' } });
    } catch (err) { next(err); }
  },

  async getMe(req, res, next) {
    try {
      const data = await authService.getMe(req.user.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async changePassword(req, res, next) {
    try {
      await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
      res.json({ success: true, data: { message: 'Password changed. All sessions revoked.' } });
    } catch (err) { next(err); }
  },

  async updateProfile(req, res, next) {
    try {
      const data = await authService.updateProfile(req.user.id, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getSessions(req, res, next) {
    try {
      const data = await authService.getSessions(req.user.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async revokeSession(req, res, next) {
    try {
      await authService.revokeSession(req.user.id, req.params.id);
      res.json({ success: true, data: { message: 'Session revoked' } });
    } catch (err) { next(err); }
  },

  async getSummary(req, res, next) {
    try {
      const data = await authService.getSummary(req.user.id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};

module.exports = authController;
