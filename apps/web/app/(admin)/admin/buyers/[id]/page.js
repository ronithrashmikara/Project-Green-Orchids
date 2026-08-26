'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Textarea } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Table } from '@/components/ui/Table';
import { StatusBadge, TierBadge, CreditBar } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function BuyerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [tier, setTier] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [reason, setReason] = useState('');
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [related, setRelated] = useState({ orders: [], invoices: [], payments: [], rmas: [] });
  const [relatedLoading, setRelatedLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/buyers/${id}`);
        const b = res.data?.data ?? res.data;
        setBuyer(b);
        setTier(b.tier || 'SILVER');
        setCreditLimit(String(b.credit_limit ?? b.creditLimit ?? 0));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!['orders', 'invoices', 'payments', 'rmas'].includes(tab)) return;
    const endpoint = tab === 'rmas' ? 'rma' : tab;
    let cancelled = false;
    setRelatedLoading(true);
    api.get(`/buyers/${id}/${endpoint}`)
      .then((res) => {
        if (cancelled) return;
        const rows = res.data?.data || [];
        setRelated((prev) => ({ ...prev, [tab]: rows }));
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load'); })
      .finally(() => { if (!cancelled) setRelatedLoading(false); });
    return () => { cancelled = true; };
  }, [tab, id]);

  const requireReason = (min) => {
    if (reason.trim().length < min) {
      toast.error(`Please provide a reason (at least ${min} characters)`);
      return false;
    }
    return true;
  };

  const refreshBuyer = async () => {
    try {
      const res = await api.get(`/buyers/${id}`);
      setBuyer(res.data?.data ?? res.data);
    } catch { /* keep current view */ }
  };

  const handleUpdateTier = async () => {
    if (!requireReason(5)) return;
    try {
      await api.patch(`/buyers/${id}/tier`, { tier, reason: reason.trim() });
      setReason('');
      await refreshBuyer();
      toast.success('Tier updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleUpdateCredit = async () => {
    if (!requireReason(5)) return;
    try {
      await api.patch(`/buyers/${id}/credit`, { credit_limit: Number(creditLimit), reason: reason.trim() });
      setReason('');
      await refreshBuyer();
      toast.success('Credit limit updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleSuspend = async () => {
    if (!requireReason(10)) {
      setConfirmSuspend(false);
      return;
    }
    try {
      await api.post(`/buyers/${id}/suspend`, { reason: reason.trim() });
      setReason('');
      setConfirmSuspend(false);
      setBuyer((b) => ({ ...b, account_status: 'SUSPENDED', status: 'SUSPENDED' }));
      toast.success('Buyer suspended');
    } catch { toast.error('Failed'); }
  };

  const handleReactivate = async () => {
    try {
      await api.post(`/buyers/${id}/reactivate`);
      setBuyer((b) => ({ ...b, account_status: 'ACTIVE', status: 'ACTIVE' }));
      toast.success('Buyer reactivated');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (error) return <ErrorState message={error} />;
  if (!buyer) return <ErrorState message="Buyer not found" />;

  const buyerStatus = buyer.account_status || buyer.status;
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'orders', label: 'Orders' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'payments', label: 'Payments' },
    { key: 'rmas', label: 'RMAs' },
    { key: 'logins', label: 'Login History' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer"
        title={buyer.business_name || buyer.businessName}
        description="View buyer account details, credit terms, and activity history."
        back={{ href: '/admin/buyers', label: 'Back to Buyers' }}
        actions={<><TierBadge tier={buyer.tier} /><StatusBadge status={buyerStatus} /></>}
        tone="emerald"
      />

      <Card className="grid grid-cols-3 gap-4">
        <div><span className="text-xs text-gray-500">Email</span><p className="font-medium">{buyer.email}</p></div>
        <div><span className="text-xs text-gray-500">Phone</span><p className="font-medium">{buyer.trade_phone || buyer.phone}</p></div>
        <div><span className="text-xs text-gray-500">Reg No</span><p className="font-medium">{buyer.business_reg_no || buyer.registrationNo}</p></div>
        <div><span className="text-xs text-gray-500">Address</span><p className="font-medium">{buyer.address}</p></div>
        <div><span className="text-xs text-gray-500">Joined</span><p className="font-medium">{formatDate(buyer.created_at || buyer.createdAt)}</p></div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium mb-3">Tier & Credit</h3>
          <div className="space-y-3">
            <Select value={tier} onChange={(e) => setTier(e.target.value)} options={[{ value: 'SILVER', label: 'Silver' }, { value: 'GOLD', label: 'Gold' }, { value: 'PLATINUM', label: 'Platinum' }]} />
            <Input label="Credit Limit" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
            <Textarea label="Reason" rows={2} placeholder="Why is this changing? Required for tier, credit and suspension actions." value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateTier}>Update Tier</Button>
              <Button size="sm" variant="outline" onClick={handleUpdateCredit}>Update Credit Limit</Button>
            </div>
          </div>
        </Card>
        <Card>
          <CreditBar used={buyer.outstanding_balance ?? buyer.creditUsed ?? 0} limit={buyer.credit_limit ?? buyer.creditLimit ?? 0} />
        </Card>
      </div>

      <div className="flex gap-2">
        {buyerStatus === 'ACTIVE' ? (
          <Button variant="danger" onClick={() => setConfirmSuspend(true)}>Suspend</Button>
        ) : buyerStatus === 'SUSPENDED' ? (
          <Button onClick={handleReactivate}>Reactivate</Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmSuspend}
        onClose={() => setConfirmSuspend(false)}
        onConfirm={handleSuspend}
        title="Suspend buyer account"
        message={`Suspend ${buyer.business_name || buyer.businessName}? They will immediately lose access to the platform until reactivated. Enter a reason above first.`}
        confirmLabel="Suspend account"
        variant="danger"
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="text-center"><div className="text-2xl font-bold">{buyer.totalOrders || 0}</div><p className="text-xs text-gray-500">Orders</p></Card>
          <Card className="text-center"><div className="text-2xl font-bold">{formatLKR(buyer.totalSpent || 0)}</div><p className="text-xs text-gray-500">Total Spent</p></Card>
          <Card className="text-center"><div className="text-2xl font-bold">{buyer.totalRmas || 0}</div><p className="text-xs text-gray-500">Returns</p></Card>
          <Card className="text-center"><div className="text-2xl font-bold">{buyer.reliabilityScore ?? 'N/A'}</div><p className="text-xs text-gray-500">Reliability</p></Card>
        </div>
      )}

      {relatedLoading && ['orders', 'invoices', 'payments', 'rmas'].includes(tab) && <Spinner className="py-10" />}

      {!relatedLoading && tab === 'orders' && (
        related.orders.length === 0 ? <EmptyState title="No orders" /> : (
          <Table columns={[
            { key: 'order_no', label: 'Order', render: (v, r) => v || r.orderNumber || `ORD-${r.id}` },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'total_amount', label: 'Total', render: (v, r) => formatLKR(v ?? r.total ?? 0) },
            { key: 'created_at', label: 'Placed', render: (v, r) => formatDate(v || r.createdAt) },
          ]} rows={related.orders} />
        )
      )}

      {!relatedLoading && tab === 'invoices' && (
        related.invoices.length === 0 ? <EmptyState title="No invoices" /> : (
          <Table columns={[
            { key: 'invoice_no', label: 'Invoice', render: (v, r) => v || `INV-${r.id}` },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'total_amount', label: 'Total', render: (v, r) => formatLKR(v ?? r.total ?? 0) },
            { key: 'balance_due', label: 'Balance Due', render: (v, r) => formatLKR(v ?? r.balanceDue ?? 0) },
            { key: 'due_date', label: 'Due', render: (v, r) => formatDate(v || r.dueDate) },
          ]} rows={related.invoices} />
        )
      )}

      {!relatedLoading && tab === 'payments' && (
        related.payments.length === 0 ? <EmptyState title="No payments" /> : (
          <Table columns={[
            { key: 'payment_no', label: 'Payment', render: (v, r) => v || `PAY-${r.id}` },
            { key: 'amount', label: 'Amount', render: (v) => formatLKR(v || 0) },
            { key: 'method', label: 'Method' },
            { key: 'created_at', label: 'Received', render: (v, r) => formatDate(v || r.createdAt) },
          ]} rows={related.payments} />
        )
      )}

      {!relatedLoading && tab === 'rmas' && (
        related.rmas.length === 0 ? <EmptyState title="No RMAs" /> : (
          <Table columns={[
            { key: 'rma_no', label: 'RMA', render: (v, r) => v || `RMA-${r.id}` },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'reason', label: 'Reason' },
            { key: 'created_at', label: 'Opened', render: (v, r) => formatDate(v || r.createdAt) },
          ]} rows={related.rmas} />
        )
      )}

      {tab === 'logins' && buyer.loginHistory ? (
        <Table columns={[
          { key: 'timestamp', label: 'Date', render: (v) => formatDate(v) },
          { key: 'ip', label: 'IP' },
          { key: 'outcome', label: 'Outcome' },
          { key: 'userAgent', label: 'Device', render: (v) => (v || '').slice(0, 60) },
        ]} rows={buyer.loginHistory} emptyMessage="No login history" />
      ) : null}
    </div>
  );
}

function Select({ label, value, onChange, options = [], className }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select value={value} onChange={onChange} className="w-full px-3 py-2 border rounded-lg text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
