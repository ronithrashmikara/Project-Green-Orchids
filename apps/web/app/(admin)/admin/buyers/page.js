'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Select, Textarea } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, TierBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

function normalizeBuyer(b) {
  return {
    id: b.id,
    businessName: b.business_name || b.businessName,
    registrationNo: b.business_reg_no || b.registrationNo,
    email: b.email,
    phone: b.phone,
    tier: b.tier,
    status: b.account_status || b.status,
  };
}

export default function BuyersPage() {
  const router = useRouter();
  const [tab, setTab] = useState('approvals');
  const [approvals, setApprovals] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [showApprove, setShowApprove] = useState(false);
  const [approveForm, setApproveForm] = useState({ tier: 'SILVER', credit_limit: '100000', payment_terms: 'NET_30' });
  const [reasonModal, setReasonModal] = useState({ open: false, buyer: null, kind: null, reason: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      if (tab === 'approvals') {
        const res = await api.get('/buyers?status=PENDING_APPROVAL').catch(() => ({ data: { data: [] } }));
        setApprovals((res.data.data || []).map(normalizeBuyer));
      } else {
        const params = search ? `?search=${search}` : '';
        const res = await api.get(`/buyers${params}`).catch(() => ({ data: { data: [] } }));
        setDirectory((res.data.data || []).map(normalizeBuyer));
      }
      setLoading(false);
    })();
  }, [tab, search]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.post(`/buyers/${selectedBuyer.id}/approve`, {
        tier: approveForm.tier,
        credit_limit: Number(approveForm.credit_limit),
        payment_terms: approveForm.payment_terms,
      });
      toast.success('Buyer approved');
      setApprovals((a) => a.filter((b) => b.id !== selectedBuyer.id));
      setShowApprove(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openReason = (buyer, kind) => setReasonModal({ open: true, buyer, kind, reason: '' });

  const handleReasonSubmit = async () => {
    const { buyer, kind, reason } = reasonModal;
    if (reason.trim().length < 10) return toast.error('Reason must be at least 10 characters');
    setSubmitting(true);
    try {
      if (kind === 'reject') {
        await api.post(`/buyers/${buyer.id}/reject`, { reason });
        setApprovals((a) => a.filter((b) => b.id !== buyer.id));
        toast.success('Buyer rejected');
      } else {
        await api.post(`/buyers/${buyer.id}/suspend`, { reason });
        setDirectory((d) => d.map((b) => b.id === buyer.id ? { ...b, status: 'SUSPENDED' } : b));
        toast.success('Buyer archived');
      }
      setReasonModal({ open: false, buyer: null, kind: null, reason: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const cols = [
    { key: 'businessName', label: 'Business' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'tier', label: 'Tier', render: (v) => <TierBadge tier={v} /> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyers"
        title="Buyer Management"
        description="Review buyer approval requests and manage the buyer directory."
        tone="emerald"
      />

      <Tabs tabs={[{ key: 'approvals', label: 'Approval Queue', count: approvals.length }, { key: 'directory', label: 'Directory' }]} active={tab} onChange={setTab} />

      {tab === 'directory' && <Input placeholder="Search buyers..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />}

      {loading ? <Spinner className="py-20" /> : (tab === 'approvals' ? approvals.length === 0 : directory.length === 0) ? <EmptyState title="No buyers" /> : (
        <Table
          columns={tab === 'approvals' ? [
            { key: 'businessName', label: 'Business' },
            { key: 'registrationNo', label: 'Reg No' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setSelectedBuyer(r); setShowApprove(true); }}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => openReason(r, 'reject')}>Reject</Button>
              </div>
            )},
          ] : [...cols, { key: 'actions', label: '', render: (_, r) => (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => router.push(`/admin/buyers/${r.id}`)}>View</Button>
              {r.status !== 'SUSPENDED' && <Button size="sm" variant="ghost" onClick={() => openReason(r, 'suspend')}>Archive</Button>}
            </div>
          )}]}
          rows={tab === 'approvals' ? approvals : directory}
        />
      )}

      <Modal open={showApprove} onClose={() => setShowApprove(false)} title="Approve Buyer">
        {selectedBuyer && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{selectedBuyer.businessName} - {selectedBuyer.email}</p>
            <Select label="Tier" value={approveForm.tier} onChange={(e) => setApproveForm((f) => ({ ...f, tier: e.target.value }))} options={[{ value: 'SILVER', label: 'Silver' }, { value: 'GOLD', label: 'Gold' }, { value: 'PLATINUM', label: 'Platinum' }]} />
            <Input label="Credit Limit (LKR)" type="number" value={approveForm.credit_limit} onChange={(e) => setApproveForm((f) => ({ ...f, credit_limit: e.target.value }))} />
            <Select label="Payment Terms" value={approveForm.payment_terms} onChange={(e) => setApproveForm((f) => ({ ...f, payment_terms: e.target.value }))} options={[{ value: 'NET_15', label: 'Net 15' }, { value: 'NET_30', label: 'Net 30' }, { value: 'NET_45', label: 'Net 45' }, { value: 'NET_60', label: 'Net 60' }]} />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowApprove(false)}>Cancel</Button>
              <Button onClick={handleApprove} loading={submitting}>Approve</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={reasonModal.open} onClose={() => setReasonModal((m) => ({ ...m, open: false }))} title={reasonModal.kind === 'reject' ? 'Reject Buyer' : 'Archive Buyer'} size="sm">
        {reasonModal.buyer && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {reasonModal.kind === 'reject'
                ? `Reject ${reasonModal.buyer.businessName}? They will need to re-apply to access the platform.`
                : `Archive ${reasonModal.buyer.businessName}? Their account will be suspended and they will lose platform access.`}
            </p>
            <Textarea
              label="Reason (required, min 10 characters)"
              value={reasonModal.reason}
              onChange={(e) => setReasonModal((m) => ({ ...m, reason: e.target.value }))}
              placeholder="Explain why..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReasonModal((m) => ({ ...m, open: false }))}>Cancel</Button>
              <Button variant="danger" onClick={handleReasonSubmit} loading={submitting}>{reasonModal.kind === 'reject' ? 'Reject' : 'Archive'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
