'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GlassPanel, DashboardHero } from '@/components/domain/DashboardUI';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const NEXT_ACTION = {
  ASSIGNED:   { label: 'Dispatch', endpoint: (id) => `/deliveries/${id}/dispatch`, method: 'patch' },
  DISPATCHED: { label: 'Mark In Transit', endpoint: (id) => `/deliveries/${id}/in-transit`, method: 'patch' },
  IN_TRANSIT: { label: 'Mark Delivered', endpoint: (id) => `/deliveries/${id}/pod`, method: 'patch' },
};

export default function DeliveryDeliveriesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [confirm, setConfirm] = useState({ open: false, delivery: null });
  const [podFile, setPodFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ assignedTo: user.id });
      if (status) params.set('status', status);
      const res = await api.get(`/deliveries?${params}`);
      setDeliveries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [status, user?.id]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  const openConfirm = (d) => {
    setPodFile(null);
    setConfirm({ open: true, delivery: d });
  };

  const handlePodFileChange = (e) => {
    const file = e.target.files?.[0];
    setPodFile(file || null);
  };

  const handleAdvance = async () => {
    const d = confirm.delivery;
    const action = NEXT_ACTION[d.status];
    if (!action) return;
    if (d.status === 'IN_TRANSIT' && !podFile) { toast.error('Attach a proof-of-delivery photo'); return; }
    setSubmitting(true);
    try {
      let data;
      if (d.status === 'IN_TRANSIT') {
        const form = new FormData();
        form.append('photo', podFile);
        const res = await api.patch(action.endpoint(d.id), form, { headers: { 'Content-Type': 'multipart/form-data' } });
        data = res.data;
      } else {
        const res = await api[action.method](action.endpoint(d.id), {});
        data = res.data;
      }
      setDeliveries((list) => list.map((x) => x.id === d.id ? { ...x, ...data } : x));
      toast.success('Delivery updated');
      setConfirm({ open: false, delivery: null });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Logistics"
        title="My deliveries"
        description="Deliveries assigned to you — dispatch, mark in-transit, and upload proof of delivery."
        tone="amber"
      />

      <GlassPanel>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </GlassPanel>

      {error && <ErrorState message={error} onRetry={fetchDeliveries} />}
      {loading ? <Spinner className="py-20" /> : deliveries.length === 0 ? <EmptyState title="No deliveries assigned to you" /> : (
        <GlassPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Delivery #', 'Order #', 'Status', 'Dispatch date', 'Buyer confirmed', 'Actions'].map((h) => (
                    <th key={h} className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((d) => {
                  const action = NEXT_ACTION[d.status];
                  return (
                    <tr key={d.id} className="group transition hover:bg-slate-50">
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-slate-800">#{String(d.id).padStart(5, '0')}</td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs text-slate-600">{d.reference_number || `#${d.order_id}`}</span>
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={d.status} /></td>
                      <td className="py-3 pr-4 text-slate-400">{d.dispatch_date ? formatDate(d.dispatch_date, 'yyyy-MM-dd') : '—'}</td>
                      <td className="py-3 pr-4 text-slate-400">{d.buyer_confirmed_at ? formatDate(d.buyer_confirmed_at, 'yyyy-MM-dd') : '—'}</td>
                      <td className="py-3">
                        {action && (
                          <button
                            onClick={() => openConfirm(d)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 opacity-0 transition group-hover:opacity-100 hover:bg-emerald-100"
                          >
                            {action.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}

      {confirm.open && confirm.delivery?.status === 'IN_TRANSIT' ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setConfirm({ open: false, delivery: null })}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-800">Mark as delivered</h3>
            <p className="mt-1 text-sm text-slate-500">Delivery #{String(confirm.delivery.id).padStart(5, '0')} · attach a proof-of-delivery photo</p>
            <label className="mt-4 flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-emerald-400">
              <span className="px-4 text-center text-sm text-slate-500">
                {podFile ? `Selected: ${podFile.name}` : '📷 Click to take/upload a photo'}
              </span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePodFileChange} />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirm({ open: false, delivery: null })} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button disabled={submitting || !podFile} onClick={handleAdvance} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60">{submitting ? 'Uploading…' : 'Confirm Delivered'}</button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmDialog
          open={confirm.open}
          onClose={() => setConfirm({ open: false, delivery: null })}
          onConfirm={handleAdvance}
          title="Advance delivery status"
          message={confirm.delivery ? `${NEXT_ACTION[confirm.delivery.status]?.label} for delivery #${String(confirm.delivery.id).padStart(5, '0')}?` : ''}
          confirmLabel="Confirm"
          variant="info"
        />
      )}
    </div>
  );
}
