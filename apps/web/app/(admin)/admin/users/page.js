'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Input, Select } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'INVENTORY_MANAGER', password: '' });
  const [confirm, setConfirm] = useState({ open: false, action: null, title: '', message: '', variant: 'warning', label: '' });

  useEffect(() => {
    (async () => {
      const res = await api.get('/admin/users').catch(() => ({ data: [] }));
      setUsers(res.data.users || res.data.data || res.data);
      setLoading(false);
    })();
  }, []);

  const handleCreate = async () => {
    try {
      await api.post('/admin/users', form);
      toast.success('User created');
      setShowCreate(false);
      const res = await api.get('/admin/users');
      setUsers(res.data.users || res.data.data || res.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDeactivate = (id) => {
    setConfirm({
      open: true,
      title: 'Deactivate user',
      message: 'This user will lose access to the system immediately. You can reactivate them later.',
      variant: 'warning',
      label: 'Deactivate',
      action: async () => {
        try {
          await api.post(`/admin/users/${id}/deactivate`);
          setUsers((u) => u.map((x) => x.id === id ? { ...x, status: 'INACTIVE' } : x));
          toast.success('Deactivated');
        } catch { toast.error('Failed'); }
      },
    });
  };

  const handleResetPassword = (id) => {
    setConfirm({
      open: true,
      title: 'Reset password',
      message: 'A password reset email will be sent to this user. Their current password will remain active until they reset it.',
      variant: 'info',
      label: 'Send Reset',
      action: async () => {
        try {
          await api.post(`/admin/users/${id}/reset-password`);
          toast.success('Password reset triggered');
        } catch { toast.error('Failed'); }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <Button onClick={() => { setForm({ name: '', email: '', role: 'INVENTORY_MANAGER', password: '' }); setShowCreate(true); }}>Create Staff</Button>
      </div>

      {loading ? <Spinner className="py-20" /> : users.length === 0 ? <EmptyState title="No users" /> : (
        <Table
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'lastLoginAt', label: 'Last Login', render: (v) => formatDate(v) },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleResetPassword(r.id)}>Reset PW</Button>
                {r.status !== 'INACTIVE' && <Button size="sm" variant="ghost" onClick={() => handleDeactivate(r.id)}>Deactivate</Button>}
              </div>
            )},
          ]}
          rows={users}
        />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Staff Account">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <Select label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} options={[
            { value: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
            { value: 'FINANCE_OFFICER', label: 'Finance Officer' },
            { value: 'DELIVERY_COORDINATOR', label: 'Delivery Coordinator' },
          ]} />
          <Input label="Temporary Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
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
