'use client';

import { Badge } from '@/components/ui/Badge';

const PRIORITY_VARIANTS = { LOW: 'default', MEDIUM: 'warning', HIGH: 'danger' };

export function PriorityBadge({ priority }) {
  if (!priority) return null;
  const label = priority.charAt(0) + priority.slice(1).toLowerCase();
  return <Badge variant={PRIORITY_VARIANTS[priority] || 'default'}>{label}</Badge>;
}

export function CategoryBadge({ category }) {
  if (!category) return null;
  return <Badge variant="info">{category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</Badge>;
}
