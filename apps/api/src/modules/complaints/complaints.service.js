const { tx } = require('../../config/db');
const { AppError } = require('../../middleware/errors');
const { writeAudit } = require('../../middleware/audit');
const { paginate } = require('../../utils/pagination');
const { pickAvailableSalesManager } = require('../../utils/assignment');
const repo = require('./complaints.repository');

// Forward-only lifecycle: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
const TRANSITIONS = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

const service = {
  async create(data, userId) {
    if (data.order_id) {
      const owns = await repo.orderBelongsToUser(data.order_id, userId);
      if (!owns) throw new AppError('FORBIDDEN', 'Order does not belong to this account', 403);
    }
    let complaint;
    await tx(async (client) => {
      // Auto-assign to the least-loaded AVAILABLE sales manager; stays
      // unassigned (claimable from the queue) when nobody is available.
      const assignee = await pickAvailableSalesManager(client);
      complaint = await repo.create(client, { ...data, buyer_id: userId, assigned_to: assignee });
      await writeAudit({ actor: userId, action: 'COMPLAINT_CREATED', entityType: 'complaints',
        entityId: String(complaint.id), after: { status: 'OPEN', assigned_to: assignee } }, client);
    });
    return complaint;
  },

  async list(queryParams, userId, isStaff) {
    const o = paginate(queryParams);
    const filters = { status: queryParams.status };
    const { rows, total } = isStaff
      ? await repo.findAll(filters, o)
      : await repo.findAllForBuyer(userId, filters, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async get(id, userId, isStaff) {
    const c = await repo.findById(id);
    if (!c) throw new AppError('NOT_FOUND', 'Complaint not found', 404);
    if (!isStaff && c.buyer_id !== userId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    const messages = await repo.findMessages(id);
    return { ...c, messages };
  },

  async addMessage(id, body, userId, isStaff) {
    const c = await repo.findById(id);
    if (!c) throw new AppError('NOT_FOUND', 'Complaint not found', 404);
    if (!isStaff && c.buyer_id !== userId) throw new AppError('FORBIDDEN', 'Access denied', 403);
    if (c.status === 'CLOSED') throw new AppError('COMPLAINT_CLOSED', 'Cannot reply to a closed complaint', 409);
    let message;
    await tx(async (client) => {
      message = await repo.addMessage(client, id, userId, body);
      // Bump updated_at so the queue reflects fresh activity.
      await client.query('UPDATE complaints SET updated_at = NOW() WHERE id = $1', [id]);
    });
    return message;
  },

  async queue(queryParams, userId) {
    const o = paginate(queryParams);
    const filters = { status: queryParams.status, assigned: queryParams.assigned };
    const { rows, total } = await repo.findQueue(userId, filters, o);
    return { data: rows, pagination: { page: o.page, limit: o.limit, total, pages: Math.ceil(total / o.limit) } };
  },

  async update(id, data, actorId) {
    if (data.status === undefined && data.assigned_to === undefined) {
      throw new AppError('NOTHING_TO_UPDATE', 'Provide status and/or assigned_to', 422);
    }
    const c = await repo.findById(id);
    if (!c) throw new AppError('NOT_FOUND', 'Complaint not found', 404);
    if (data.assigned_to) {
      const ok = await repo.isStaffAssignable(data.assigned_to);
      if (!ok) throw new AppError('INVALID_ASSIGNEE', 'assigned_to must be an active sales manager or admin', 422);
    }
    let updated;
    await tx(async (client) => {
      // Lock + re-check under the lock so concurrent transitions serialize (FINDING-S01 pattern).
      const locked = await repo.lockForUpdate(client, id);
      if (!locked) throw new AppError('NOT_FOUND', 'Complaint not found', 404);
      const changes = {};
      if (data.status !== undefined && data.status !== locked.status) {
        if (!TRANSITIONS[locked.status].includes(data.status)) {
          throw new AppError('INVALID_TRANSITION',
            `Cannot transition COMPLAINT from ${locked.status} to ${data.status}`, 409,
            { from: locked.status, to: data.status, allowedTransitions: TRANSITIONS[locked.status] });
        }
        changes.status = data.status;
        if (data.status === 'RESOLVED') changes.resolved_at = new Date();
      }
      if (data.assigned_to !== undefined) {
        if (locked.status === 'CLOSED') throw new AppError('COMPLAINT_CLOSED', 'Cannot reassign a closed complaint', 409);
        changes.assigned_to = data.assigned_to; // null = unassign
      }
      if (!Object.keys(changes).length) { updated = locked; return; }
      updated = await repo.update(client, id, changes);
      await writeAudit({ actor: actorId, action: 'COMPLAINT_UPDATED', entityType: 'complaints',
        entityId: String(id),
        before: { status: locked.status, assigned_to: locked.assigned_to },
        after: { status: updated.status, assigned_to: updated.assigned_to } }, client);
    });
    return updated;
  },
};
module.exports = service;
