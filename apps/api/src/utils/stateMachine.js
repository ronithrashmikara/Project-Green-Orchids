const { AppError } = require('../middleware/errors');

/**
 * State machines (Findings 8 & 21).
 * Status names are aligned EXACTLY with the database CHECK constraints
 * (migrations 0003–0006 + 0009). Actor tokens are the logical roles the service
 * layer passes — ADMIN, BUYER, INVENTORY, FINANCE, DELIVERY, SYSTEM — not the
 * invented ORDER_MANAGER / SALES_MANAGER / WAREHOUSE_MANAGER names that never
 * existed in the seed.
 *
 * Invariant (unit-tested): every state referenced here is a member of its
 * table's CHECK list.
 */
const STATE_MACHINES = {
  ORDER: {
    transitions: [
      { from: 'PENDING_APPROVAL', to: 'APPROVED',  roles: ['ADMIN'] },
      { from: 'PENDING_APPROVAL', to: 'REJECTED',  roles: ['ADMIN'] },
      { from: 'PENDING_APPROVAL', to: 'CANCELLED', roles: ['BUYER', 'ADMIN'] },
      { from: 'APPROVED',         to: 'CANCELLED', roles: ['BUYER', 'ADMIN'] },
      { from: 'APPROVED',         to: 'DISPATCHED', roles: ['ADMIN', 'DELIVERY'] },
      { from: 'DISPATCHED',       to: 'DELIVERED', roles: ['ADMIN', 'DELIVERY'] },
      { from: 'DELIVERED',        to: 'CLOSED',    roles: ['BUYER'] },
    ],
  },
  RFQ: {
    transitions: [
      { from: 'SUBMITTED',    to: 'UNDER_REVIEW', roles: ['ADMIN'] },
      { from: 'UNDER_REVIEW', to: 'QUOTED',       roles: ['ADMIN'] },
      { from: 'QUOTED',       to: 'ACCEPTED',     roles: ['BUYER'] },
      { from: 'QUOTED',       to: 'REJECTED',     roles: ['BUYER'] },
      { from: 'QUOTED',       to: 'EXPIRED',      roles: ['SYSTEM'] },
      { from: 'ACCEPTED',     to: 'CONVERTED',    roles: ['BUYER', 'ADMIN'] },
      { from: 'SUBMITTED',    to: 'DECLINED',     roles: ['ADMIN'] },
      { from: 'UNDER_REVIEW', to: 'DECLINED',     roles: ['ADMIN'] },
    ],
  },
  RMA: {
    transitions: [
      { from: 'PENDING',       to: 'APPROVED',      roles: ['ADMIN', 'FINANCE'] },
      { from: 'PENDING',       to: 'REJECTED',       roles: ['ADMIN', 'FINANCE'] },
      { from: 'PENDING',       to: 'CANCELLED',      roles: ['BUYER'] },
      { from: 'APPROVED',      to: 'ITEM_RECEIVED',  roles: ['ADMIN', 'FINANCE'] },
      { from: 'APPROVED',      to: 'RESOLVED',       roles: ['ADMIN', 'FINANCE'] },
      { from: 'ITEM_RECEIVED', to: 'RESOLVED',       roles: ['ADMIN', 'FINANCE'] },
    ],
  },
  DELIVERY: {
    transitions: [
      { from: 'PENDING',    to: 'ASSIGNED',   roles: ['ADMIN', 'DELIVERY'] },
      { from: 'ASSIGNED',   to: 'DISPATCHED', roles: ['ADMIN', 'DELIVERY'] },
      { from: 'DISPATCHED', to: 'IN_TRANSIT', roles: ['ADMIN', 'DELIVERY'] },
      { from: 'IN_TRANSIT', to: 'DELIVERED',  roles: ['ADMIN', 'DELIVERY'] },
      { from: 'DISPATCHED', to: 'FAILED',     roles: ['ADMIN', 'DELIVERY'] },
      { from: 'IN_TRANSIT', to: 'FAILED',     roles: ['ADMIN', 'DELIVERY'] },
      { from: 'DELIVERED',  to: 'CONFIRMED',  roles: ['BUYER'] },
    ],
  },
  INVOICE: {
    transitions: [
      { from: 'PENDING',        to: 'PARTIALLY_PAID', roles: ['SYSTEM'] },
      { from: 'PARTIALLY_PAID', to: 'PAID',           roles: ['SYSTEM'] },
      { from: 'PENDING',        to: 'PAID',           roles: ['SYSTEM'] },
      { from: 'PENDING',        to: 'OVERDUE',        roles: ['SYSTEM'] },
      { from: 'PARTIALLY_PAID', to: 'OVERDUE',        roles: ['SYSTEM'] },
      { from: 'PENDING',        to: 'ADJUSTED',       roles: ['SYSTEM'] },
      { from: 'PARTIALLY_PAID', to: 'ADJUSTED',       roles: ['SYSTEM'] },
    ],
  },
};

function assertTransition(entityType, fromStatus, toStatus, role) {
  const machine = STATE_MACHINES[entityType];
  if (!machine) throw new AppError('UNKNOWN_ENTITY', `Unknown entity type: ${entityType}`, 500);

  const validTransition = machine.transitions.find(t => t.from === fromStatus && t.to === toStatus);
  if (!validTransition) {
    const allowed = machine.transitions.filter(t => t.from === fromStatus).map(t => t.to);
    throw new AppError('INVALID_TRANSITION',
      `Cannot transition ${entityType} from ${fromStatus} to ${toStatus}`, 409,
      { from: fromStatus, to: toStatus, allowedTransitions: allowed });
  }
  if (role !== 'SYSTEM' && !validTransition.roles.includes(role)) {
    throw new AppError('FORBIDDEN_TRANSITION',
      `Role ${role} is not allowed to transition ${entityType} from ${fromStatus} to ${toStatus}`, 403);
  }
  return true;
}

function getAllowedTransitions(entityType, fromStatus, role) {
  const machine = STATE_MACHINES[entityType];
  if (!machine) return [];
  return machine.transitions
    .filter(t => t.from === fromStatus && (role === 'SYSTEM' || t.roles.includes(role)))
    .map(t => t.to);
}

module.exports = { STATE_MACHINES, assertTransition, getAllowedTransitions };
