'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Input, Textarea } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

function normalizeSupplier(s) {
  return {
    id: s.id,
    name: s.name,
    contactPerson: s.contact_person,
    email: s.email,
    phone: s.phone,
    address: s.address,
    leadTime: s.lead_time_days,
    productCount: Number(s.product_count || 0),
    status: s.status,
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', leadTime: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await api.get('/suppliers?limit=100').catch(() => ({ data: { data: [] } }));
    setSuppliers((res.data.data || []).map(normalizeSupplier));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, contactPerson: s.contactPerson || '', email: s.email || '', phone: s.phone || '', address: s.address || '', leadTime: String(s.leadTime || '') });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      contact_person: form.contactPerson || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      lead_time_days: form.leadTime ? parseInt(form.leadTime, 10) : undefined,
    };
    try {
      if (editing) {
        await api.patch(`/suppliers/${editing.id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/suppliers', payload);
        toast.success('Created');
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/suppliers/${deleteTarget.id}`);
      setSuppliers((s) => s.map((x) => x.id === deleteTarget.id ? { ...x, status: 'INACTIVE' } : x));
      toast.success('Supplier deactivated');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Suppliers"
        title="Supplier Management"
        description="Manage supplier records and lead times."
        actions={<Button onClick={() => { setEditing(null); setForm({ name: '', contactPerson: '', email: '', phone: '', address: '', leadTime: '' }); setShowForm(true); }}>Add Supplier</Button>}
        tone="emerald"
      />
      {loading ? <Spinner className="py-20" /> : suppliers.length === 0 ? <EmptyState title="No suppliers" /> : (
        <Table
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'contactPerson', label: 'Contact' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'leadTime', label: 'Lead Time (days)' },
            { key: 'productCount', label: 'Products' },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                {r.status !== 'INACTIVE' && <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)}>Deactivate</Button>}
              </div>
            )},
          ]}
          rows={suppliers}
        />
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Supplier' : 'New Supplier'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Contact Person" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Textarea label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Input label="Lead Time (days)" type="number" value={form.leadTime} onChange={(e) => setForm((f) => ({ ...f, leadTime: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate supplier"
        message={`Deactivate "${deleteTarget?.name}"? They will be hidden from new-product supplier selection, but existing products keep their history.`}
        confirmLabel="Deactivate"
        variant="danger"
      />
    </div>
  );
}
