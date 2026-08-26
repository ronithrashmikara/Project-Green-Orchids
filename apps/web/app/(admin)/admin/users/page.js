'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Input, Select } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role_id: '', password: '' });
  const [roles, setRoles] = useState([]);
  const [confirm, setConfirm] = useState({ open: false, action: null, title: '', message: '', variant: 'warning', label: '', identifier: null });

  useEffect(() => {
    (async () => {
      const [res, rolesRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/users/roles').catch(() => ({ data: [] })),
      ]);
      const payload = res.data;
      setUsers(payload.users || payload.data || (Array.isArray(payload) ? payload : []));
      const roleList = rolesRes.data.data || (Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setRoles(roleList);
      setForm((f) => ({ ...f, role_id: f.role_id || roleList[0]?.id || '' }));
      setLoading(false);
    })();
  }, []);

  const handleCreate = async () => {
    try {
      await api.post('/users', { name: form.name, email: form.email, role_id: Number(form.role_id), password: form.password });
      toast.success('User created');
      setShowCreate(false);
      const res = await api.get('/users');
      const payload = res.data;
      setUsers(payload.users || payload.data || (Array.isArray(payload) ? payload : []));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDeactivate = (user) => {
    setConfirm({
      open: true,
      title: 'Deactivate user',
      message: 'This user will lose access to the system immediately. You can reactivate them later.',
      variant: 'warning',
      label: 'Deactivate',
      identifier: user.email,
      action: async () => {
        try {
          await api.patch(`/users/${user.id}`, { status: 'INACTIVE' });
          setUsers((u) => u.map((x) => x.id === user.id ? { ...x, status: 'INACTIVE' } : x));
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
      identifier: null,
      action: async () => {
        try {
          await api.post(`/auth/forgot-password`, { email: users.find((u) => u.id === id)?.email });
          toast.success('Password reset triggered');
        } catch { toast.error('Failed'); }
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff"
        title="Staff Management"
        description="Manage internal staff accounts and access."
        actions={<Button onClick={() => { setForm((f) => ({ name: '', email: '', role_id: f.role_id, password: '' })); setShowCreate(true); }}>Create Staff</Button>}
        tone="emerald"
      />

      {loading ? <Spinner className="py-20" /> : users.length === 0 ? <EmptyState title="No users" /> : (
        <Table
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'role_name', label: 'Role' },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'last_login_at', label: 'Last Login', render: (v) => formatDate(v) },
            { key: 'actions', label: '', render: (_, r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleResetPassword(r.id)}>Reset PW</Button>
                {r.status !== 'INACTIVE' && <Button size="sm" variant="ghost" onClick={() => handleDeactivate(r)}>Deactivate</Button>}
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
          <Select label="Role" value={form.role_id} onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value ? Number(e.target.value) : '' }))} options={roles.map((r) => ({ value: r.id, label: r.name }))} />
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
        requireTypedConfirmation={confirm.identifier}
      />
    </div>
  );
}
