'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Segments that should keep a fixed casing rather than simple Title Case. */
const ACRONYMS = { rfq: 'RFQ', rfqs: 'RFQs', rma: 'RMA', cms: 'CMS', id: 'ID', po: 'PO' };

/* A segment is "dynamic" when it looks like a database id rather than a word:
   pure numbers, UUIDs, or long opaque tokens (cuid/nanoid/hex). */
const isDynamicSegment = (seg) =>
  /^\d+$/.test(seg) ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) ||
  (/^[a-z0-9_-]{12,}$/i.test(seg) && /\d/.test(seg));

const humanize = (seg) => {
  const decoded = decodeURIComponent(seg);
  if (ACRONYMS[decoded.toLowerCase()]) return ACRONYMS[decoded.toLowerCase()];
  if (isDynamicSegment(decoded)) {
    return decoded.length > 10 ? `${decoded.slice(0, 8)}…` : 'Detail';
  }
  return decoded
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Path-derived breadcrumb trail: Workspace name › Section › Page.
 *
 * `rootLabel` / `rootHref` describe the workspace root crumb (e.g. "Admin
 * Suite" → /admin/dashboard); the first path segment (the workspace prefix)
 * is folded into that crumb rather than repeated.
 */
export function Breadcrumbs({ rootLabel, rootHref, className }) {
  const pathname = usePathname();

  const segments = (pathname || '')
    .split('/')
    .filter(Boolean)
    // Route-group prefixes like "(admin)" never reach usePathname, but guard anyway.
    .filter((seg) => !(seg.startsWith('(') && seg.endsWith(')')));

  // Fold the workspace prefix ("/admin", "/buyer", …) into the root crumb.
  const rest = segments.slice(1);

  const crumbs = [{ label: rootLabel, href: rootHref }];
  let acc = `/${segments[0] || ''}`;
  rest.forEach((seg) => {
    acc += `/${seg}`;
    crumbs.push({ label: humanize(seg), href: acc });
  });

  // Avoid "Admin Suite › Dashboard" collapsing into a single duplicate crumb.
  if (crumbs.length === 2 && crumbs[1].href === rootHref) crumbs.pop();

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />}
              {isLast ? (
                <span aria-current="page" className="truncate font-semibold text-slate-800">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate font-medium text-slate-400 transition hover:text-slate-700"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
