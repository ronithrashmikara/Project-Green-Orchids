import api from './api';

/* Shared fetchers/normalizers for the Sales Desk workspace.
   Responses follow the app envelope: payload lives under res.data.data. */

export const unwrap = (res) => res?.data?.data ?? res?.data ?? null;

/* GET /sales/queue → { approvals: [...], complaints: [...] } */
export async function fetchSalesQueue() {
  const res = await api.get('/sales/queue');
  const d = unwrap(res) || {};
  return {
    approvals: d.approvals || d.pending_approvals || d.orders || [],
    complaints: d.complaints || d.open_complaints || [],
  };
}

/* GET /sales/availability → normalized to
   [{ user_id, name, status, open_complaints, pending_approvals }].
   The API returns { id, full_name, availability, open_complaints, pending_orders }. */
export async function fetchAvailability() {
  const res = await api.get('/sales/availability');
  const d = unwrap(res);
  const rows = Array.isArray(d) ? d : d?.managers || d?.availability || [];
  return rows.map((r) => ({
    ...r,
    user_id: r.user_id ?? r.id,
    name: r.name ?? r.full_name ?? r.email,
    status: r.status ?? r.availability ?? 'AWAY',
    open_complaints: Number(r.open_complaints ?? 0),
    pending_approvals: Number(r.pending_approvals ?? r.pending_orders ?? 0),
  }));
}

export const isUnassigned = (row) => !(row.assigned_to || row.assignedTo);
export const isMine = (row, userId) =>
  String(row.assigned_to ?? row.assignedTo ?? '') === String(userId ?? '');

export const COMPLAINT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const COMPLAINT_CATEGORIES = [
  { value: 'ORDER_ISSUE', label: 'Order issue' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'OTHER', label: 'Other' },
];
export const COMPLAINT_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];
