'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Input } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function TiersPage() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', discount: '0', creditLimit: '100000', paymentTerms: 'Net 30', minOrders: '0' });
  const [confirm, setConfirm] = useState({ open: false, action: null, title: '', message: '', label: '', variant: 'danger' });

  useEffect(() => {
    (async () => {
      const res = await api.get('/admin/tiers').catch(() => ({ data: [] }));
      setTiers(res.data.tiers || res.data.data || res.data);
      setLoading(false);
    })();
  }, []);

  const openEdit = (tier) => {
    setEditing(tier);
    setForm({ name: tier.name || '', discount: String(tier.discount || 0), creditLimit: String(tier.creditLimit || 100000), paymentTerms: tier.paymentTerms || 'Net 30', minOrders: String(tier.minOrders || 0) });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await api.put(`/admin/tiers/${editing.id}`, { ...form, discount: parseFloat(form.discount), creditLimit: parseFloat(form.creditLimit), minOrders: parseInt(form.minOrders) });
        setTiers((t) => t.map((x) => x.id === editing.id ? { ...x, ...form, discount: parseFloat(form.discount), creditLimit: parseFloat(form.creditLimit), minOrders: parseInt(form.minOrders) } : x));
        toast.success('Tier updated');
      } else {
        const res = await api.post('/admin/tiers', { ...form, discount: parseFloat(form.discount), creditLimit: parseFloat(form.creditLimit), minOrders: parseInt(form.minOrders) });
        setTiers((t) => [...t, res.data.data]);
        toast.success('Tier created');
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    }
  };

  const handleDelete = (id) => {
    setConfirm({
      open: true,
      title: 'Delete tier',
      message: 'Delete this tier? This may affect buyers assigned to it.',
      label: 'Delete',
      variant: 'danger',
      action: async () => {
        try {
          await api.delete(`/admin/tiers/${id}`);
          setTiers((t) => t.filter((x) => x.id !== id));
          toast.success('Tier deleted');
        } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed'); }
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tiers"
        title="Tier Management"
        description="Configure buyer tier discounts, credit limits, and payment terms."
        actions={<Button onClick={() => { setEditing(null); setForm({ name: '', discount: '0', creditLimit: '100000', paymentTerms: 'Net 30', minOrders: '0' }); setShowForm(true); }}>Add Tier</Button>}
        tone="emerald"
      />

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">⚠ Changing tier parameters will only affect future orders. Existing buyers keep their current terms until renewed.</div>

      {loading ? <Spinner className="py-20" /> : tiers.length === 0 ? <EmptyState title="No tiers" /> : (
        <Table
          columns={[
            { key: 'name', label: 'Tier', render: (v) => <strong>{v}</strong> },
            { key: 'discount', label: 'Discount', render: (v) => `${v}%` },
            { key: 'creditLimit', label: 'Credit Limit', render: (v) => formatLKR(v) },
            { key: 'paymentTerms', label: 'Terms' },
            { key: 'minOrders', label: 'Min Orders' },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>Delete</Button>
              </div>
            )},
          ]}
          rows={tiers}
        />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Tier' : 'New Tier'}>
        <div className="space-y-4">
          <Input label="Tier Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Discount (%)" type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
          <Input label="Credit Limit (LKR)" type="number" value={form.creditLimit} onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))} />
          <Input label="Payment Terms" value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} />
          <Input label="Minimum Orders" type="number" value={form.minOrders} onChange={(e) => setForm((f) => ({ ...f, minOrders: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
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
