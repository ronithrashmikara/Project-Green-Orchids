const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { tx } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const usersRepository = require('./users.repository');
const authRepository = require('../auth/auth.repository');
const { paginate } = require('../../utils/pagination');

const usersService = {
  async listUsers(queryParams) {
    const pageOpts = paginate(queryParams);
    const { rows, total } = await usersRepository.findAll(pageOpts);
    return {
      data: rows,
      pagination: { page: pageOpts.page, limit: pageOpts.limit, total, pages: Math.ceil(total / pageOpts.limit) },
    };
  },

  async createUser(data, actor) {
    const existing = await authRepository.findUserByEmail(data.email);
    if (existing) throw new AppError('EMAIL_EXISTS', 'Email already in use', 409);

    const tempPassword = uuidv4().substring(0, 16);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { query } = require('../../config/db');
    let roleId = data.role_id;
    if (!roleId && data.role) {
      const roleRes = await query('SELECT id FROM roles WHERE name = $1', [data.role]);
      roleId = roleRes.rows[0]?.id;
    }
    const user = await usersRepository.create({
      email: data.email,
      passwordHash,
      name: data.name,
      roleId,
    });

    // Create password setup token
    const setupToken = uuidv4();
    await authRepository.createEmailToken(null, {
      userId: user.id,
      token: setupToken,
      type: 'PASSWORD_SETUP',
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    // Audit
    await writeAudit({
      actor, action: 'USER_CREATED', entity: 'users', entityId: user.id,
      after: { email: user.email, name: user.name, role_id: user.role_id },
    });

    if (data.send_setup_email !== false) {
      try {
        await sendMail({
          to: data.email,
          subject: 'Set up your password - Orchids Staff',
          template: 'reset_password',
          data: { name: data.name, resetUrl: `${process.env.CORS_ORIGIN || ''}/setup-password/${setupToken}` },
        });
      } catch (_) {}
    }

    return user;
  },

  async getUser(id) {
    const user = await usersRepository.findById(id);
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
    return user;
  },

  async updateUser(id, updates, actor) {
    const user = await usersRepository.findById(id);
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    const before = { status: user.status, role_id: user.role_id, name: user.name };
    const updated = await usersRepository.update(id, updates);

    await writeAudit({
      actor, action: 'USER_UPDATED', entity: 'users', entityId: id,
      before, after: updates,
    });

    if (updates.status === 'SUSPENDED' || updates.status === 'INACTIVE') {
      await authRepository.revokeAllUserSessions(null, id);
    }

    return updated;
  },

  async getLoginHistory(userId, queryParams) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    const pageOpts = paginate(queryParams);
    const { rows, total } = await usersRepository.findLoginHistory(userId, pageOpts);
    return {
      data: rows,
      pagination: { page: pageOpts.page, limit: pageOpts.limit, total, pages: Math.ceil(total / pageOpts.limit) },
    };
  },
};

module.exports = usersService;
