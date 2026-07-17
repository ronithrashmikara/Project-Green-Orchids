import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { utcToZonedTime as toZonedTime } from 'date-fns-tz';

const COLOMBO_TZ = 'Asia/Colombo';

export function cn(...classes) {
  return twMerge(clsx(...classes));
}

export function formatLKR(amount) {
  if (amount == null) return 'LKR 0.00';
  let num = typeof amount === 'string' ? parseFloat(amount) : amount;
  // Normalize -0 / tiny negative float-drift (e.g. -0.001) so a fully-credited
  // or 100%-reversed invoice never displays as "LKR -0.00".
  if (Math.abs(num) < 0.005) num = 0;
  return `LKR ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/* Compact currency for KPI cards / tight data displays:
   LKR 1.2M, LKR 340K, LKR 985.00 — keeps metric cards on one line. */
export function formatLKRCompact(amount) {
  if (amount == null) return 'LKR 0';
  let num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Math.abs(num) < 0.005) num = 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}LKR ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 100_000) return `${sign}LKR ${Math.round(abs / 1_000)}K`;
  if (abs >= 10_000) return `${sign}LKR ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}LKR ${abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatDate(date, fmt = 'dd MMM yyyy') {
  if (!date) return '';
  const zoned = toZonedTime(new Date(date), COLOMBO_TZ);
  return format(zoned, fmt);
}

export function formatDateTime(date) {
  return formatDate(date, 'dd MMM yyyy, HH:mm');
}

export function formatDateShort(date) {
  return formatDate(date, 'yyyy-MM-dd');
}

export function formatRelative(date) {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function statusColor(status) {
  const map = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    QUOTED: 'bg-purple-100 text-purple-800',
    ACCEPTED: 'bg-green-100 text-green-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    DECLINED: 'bg-red-100 text-red-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-indigo-100 text-indigo-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    RETURNED: 'bg-orange-100 text-orange-800',
    EXPIRED: 'bg-gray-100 text-gray-500',
    UNPAID: 'bg-red-100 text-red-800',
    PAID: 'bg-green-100 text-green-800',
    PARTIAL: 'bg-yellow-100 text-yellow-800',
    OVERDUE: 'bg-red-100 text-red-800',
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    LOW_STOCK: 'bg-orange-100 text-orange-800',
    OUT_OF_STOCK: 'bg-red-100 text-red-800',
    IN_STOCK: 'bg-green-100 text-green-800',
    FAST_MOVING: 'bg-blue-100 text-blue-800',
    DEAD_STOCK: 'bg-gray-100 text-gray-800',
    READY: 'bg-green-100 text-green-800',
    IN_TRANSIT: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    AWAITING_APPROVAL: 'bg-yellow-100 text-yellow-800',
    DISPATCHED: 'bg-indigo-100 text-indigo-800',
    COMPLETED: 'bg-green-100 text-green-800',
    OPEN: 'bg-blue-100 text-blue-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  };
  return map[status?.toUpperCase()] || 'bg-gray-100 text-gray-600';
}

export function statusLabel(status) {
  return status
    ? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
}

export { cn as classNames };
