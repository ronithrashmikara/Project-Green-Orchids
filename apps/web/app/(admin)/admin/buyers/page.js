'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Select } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge, TierBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate, formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function BuyersPage() {
  const router = useRouter();
  const [tab, setTab] = useState('approvals');
  const [approvals, setApprovals] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [showApprove, setShowApprove] = useState(false);
  const [approveForm, setApproveForm] = useState({ tier: 'SILVER', creditLimit: '100000', paymentTerms: 'Net 30' });
  const [confirm, setConfirm] = useState({ open: false, action: null, title: '', message: '', label: '', variant: 'danger' });

  useEffect(() => {
    setLoading(true);
    (async () => {
      if (tab === 'approvals') {
        const res = await api.get('/admin/buyers?status=AWAITING_APPROVAL').catch(() => ({ data: [] }));
        setApprovals(res.data.buyers || res.data.data || res.data);
      } else {
        const params = search ? `?search=${search}` : '';
        const res = await api.get(`/admin/buyers${params}`).catch(() => ({ data: [] }));
        setDirectory(res.data.buyers || res.data.data || res.data);
      }
      setLoading(false);
    })();
  }, [tab, search]);

  const handleApprove = async () => {
    try {
      await api.post(`/admin/buyers/${selectedBuyer.id}/approve`, approveForm);
      toast.success('Buyer approved');
      setApprovals((a) => a.filter((b) => b.id !== selectedBuyer.id));
      setShowApprove(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleReject = (buyer) => {
    setConfirm({
      open: true,
      title: 'Reject buyer',
      message: `Reject ${buyer.businessName}? They will be notified and will need to re-apply to access the platform.`,
      label: 'Reject',
      variant: 'danger',
      action: async () => {
        try {
          await api.post(`/admin/buyers/${buyer.id}/reject`);
          setApprovals((a) => a.filter((b) => b.id !== buyer.id));
          toast.success('Buyer rejected');
        } catch { toast.error('Failed'); }
      },
    });
  };

  const handleArchive = (buyer) => {
    setConfirm({
      open: true,
      title: 'Archive buyer account',
      message: `Archive ${buyer.businessName}? Their account will be suspended and they will lose platform access.`,
      label: 'Archive',
      variant: 'warning',
      action: async () => {
        try {
          await api.post(`/admin/buyers/${buyer.id}/suspend`).catch(() => api.patch(`/admin/buyers/${buyer.id}`, { status: 'SUSPENDED' }));
          setDirectory((d) => d.map((b) => b.id === buyer.id ? { ...b, status: 'SUSPENDED' } : b));
          toast.success('Buyer archived');
        } catch { toast.error('Failed'); }
      },
    });
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
      <h1 className="text-2xl font-bold">Buyer Management</h1>

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
                <Button size="sm" variant="danger" onClick={() => handleReject(r)}>Reject</Button>
              </div>
            )},
          ] : [...cols, { key: 'actions', label: '', render: (_, r) => (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => router.push(`/admin/buyers/${r.id}`)}>View</Button>
              {r.status !== 'SUSPENDED' && <Button size="sm" variant="ghost" onClick={() => handleArchive(r)}>Archive</Button>}
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
            <Input label="Credit Limit (LKR)" type="number" value={approveForm.creditLimit} onChange={(e) => setApproveForm((f) => ({ ...f, creditLimit: e.target.value }))} />
            <Input label="Payment Terms" value={approveForm.paymentTerms} onChange={(e) => setApproveForm((f) => ({ ...f, paymentTerms: e.target.value }))} />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowApprove(false)}>Cancel</Button>
              <Button onClick={handleApprove}>Approve</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm((c) => ({ ...c, open: false }))}
        onConfirm={() => confirm.action?.()}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.label}
        variant={confirm.variant}
      />
    </div>
  );
}
