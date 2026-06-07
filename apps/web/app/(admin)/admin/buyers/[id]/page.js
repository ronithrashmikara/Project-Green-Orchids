'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Table } from '@/components/ui/Table';
import { StatusBadge, TierBadge, CreditBar } from '@/components/domain/StatusBadge';
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

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/admin/buyers/${id}`);
        const b = res.data;
        setBuyer(b);
        setTier(b.tier || 'SILVER');
        setCreditLimit(String(b.creditLimit || 0));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleUpdate = async () => {
    try {
      await api.put(`/admin/buyers/${id}`, { tier, creditLimit: parseFloat(creditLimit) });
      toast.success('Updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleSuspend = async () => {
    try {
      await api.post(`/admin/buyers/${id}/suspend`);
      setBuyer((b) => ({ ...b, status: 'SUSPENDED' }));
      toast.success('Buyer suspended');
    } catch { toast.error('Failed'); }
  };

  const handleReactivate = async () => {
    try {
      await api.post(`/admin/buyers/${id}/reactivate`);
      setBuyer((b) => ({ ...b, status: 'ACTIVE' }));
      toast.success('Buyer reactivated');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner className="py-20" />;
  if (error) return <ErrorState message={error} />;
  if (!buyer) return <ErrorState message="Buyer not found" />;

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
      <button onClick={() => router.back()} className="text-sm text-green-700 hover:underline">&larr; Back</button>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{buyer.businessName}</h1>
        <div className="flex gap-2">
          <TierBadge tier={buyer.tier} />
          <StatusBadge status={buyer.status} />
        </div>
      </div>

      <Card className="grid grid-cols-3 gap-4">
        <div><span className="text-xs text-gray-500">Email</span><p className="font-medium">{buyer.email}</p></div>
        <div><span className="text-xs text-gray-500">Phone</span><p className="font-medium">{buyer.phone}</p></div>
        <div><span className="text-xs text-gray-500">Reg No</span><p className="font-medium">{buyer.registrationNo}</p></div>
        <div><span className="text-xs text-gray-500">Address</span><p className="font-medium">{buyer.address}</p></div>
        <div><span className="text-xs text-gray-500">Joined</span><p className="font-medium">{formatDate(buyer.createdAt)}</p></div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium mb-3">Tier & Credit</h3>
          <div className="space-y-3">
            <Select value={tier} onChange={(e) => setTier(e.target.value)} options={[{ value: 'SILVER', label: 'Silver' }, { value: 'GOLD', label: 'Gold' }, { value: 'PLATINUM', label: 'Platinum' }]} />
            <Input label="Credit Limit" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
            <Button size="sm" onClick={handleUpdate}>Update Tier & Credit</Button>
          </div>
        </Card>
        <Card>
          <CreditBar used={buyer.creditUsed || 0} limit={buyer.creditLimit || 0} />
        </Card>
      </div>

      <div className="flex gap-2">
        {buyer.status === 'ACTIVE' ? (
          <Button variant="danger" onClick={handleSuspend}>Suspend</Button>
        ) : buyer.status === 'SUSPENDED' ? (
          <Button onClick={handleReactivate}>Reactivate</Button>
        ) : null}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="text-center"><div className="text-2xl font-bold">{buyer.totalOrders || 0}</div><p className="text-xs text-gray-500">Orders</p></Card>
          <Card className="text-center"><div className="text-2xl font-bold">{formatLKR(buyer.totalSpent || 0)}</div><p className="text-xs text-gray-500">Total Spent</p></Card>
          <Card className="text-center"><div className="text-2xl font-bold">{buyer.totalRmas || 0}</div><p className="text-xs text-gray-500">Returns</p></Card>
          <Card className="text-center"><div className="text-2xl font-bold">{buyer.reliabilityScore ?? 'N/A'}</div><p className="text-xs text-gray-500">Reliability</p></Card>
        </div>
      )}

      {tab === 'logins' && buyer.loginHistory ? (
        <Table columns={[
          { key: 'timestamp', label: 'Date', render: (v) => formatDate(v) },
          { key: 'ip', label: 'IP' },
          { key: 'outcome', label: 'Outcome' },
          { key: 'userAgent', label: 'Device', render: (v) => (v || '').slice(0, 60) },
        ]} rows={buyer.loginHistory} emptyMessage="No login history" />
      ) : tab !== 'overview' ? (
        <EmptyState title="No data available" />
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
