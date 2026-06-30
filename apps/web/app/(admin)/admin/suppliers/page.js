'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Input, Textarea } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', leadTime: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await api.get('/admin/suppliers').catch(() => ({ data: [] }));
      setSuppliers(res.data.suppliers || res.data.data || res.data);
      setLoading(false);
    })();
  }, []);

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, contactPerson: s.contactPerson || '', email: s.email || '', phone: s.phone || '', address: s.address || '', leadTime: String(s.leadTime || '') });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await api.put(`/admin/suppliers/${editing.id}`, { ...form, leadTime: parseInt(form.leadTime) || 0 });
        setSuppliers((s) => s.map((x) => x.id === editing.id ? { ...x, ...form } : x));
        toast.success('Updated');
      } else {
        const res = await api.post('/admin/suppliers', { ...form, leadTime: parseInt(form.leadTime) || 0 });
        setSuppliers((s) => [...s, res.data]);
        toast.success('Created');
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/suppliers/${deleteTarget.id}`);
      setSuppliers((s) => s.filter((x) => x.id !== deleteTarget.id));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Supplier Management</h1>
        <Button onClick={() => { setEditing(null); setForm({ name: '', contactPerson: '', email: '', phone: '', address: '', leadTime: '' }); setShowForm(true); }}>Add Supplier</Button>
      </div>
      {loading ? <Spinner className="py-20" /> : suppliers.length === 0 ? <EmptyState title="No suppliers" /> : (
        <Table
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'contactPerson', label: 'Contact' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'leadTime', label: 'Lead Time (days)' },
            { key: 'productCount', label: 'Products' },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)}>Delete</Button>
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
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete supplier"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone and may affect associated products.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
