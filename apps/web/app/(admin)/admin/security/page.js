'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Input, Select } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { StatusBadge, AuditDiffViewer } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SecurityPage() {
  const [tab, setTab] = useState('logins');
  const [logins, setLogins] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [lockedAccounts, setLockedAccounts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPages, setAuditPages] = useState(1);
  const [settings, setSettings] = useState({ sessionCap: '5', lockoutThreshold: '5', lockoutDuration: '30' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [loginFilters, setLoginFilters] = useState({ user: '', outcome: '', ip: '', dateFrom: '', dateTo: '' });

  const loadTab = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case 'logins': {
          const params = new URLSearchParams({ page: String(page), limit: '20' });
          if (loginFilters.user) params.set('user', loginFilters.user);
          if (loginFilters.outcome) params.set('outcome', loginFilters.outcome);
          const res = await api.get(`/admin/security/logins?${params}`);
          setLogins(res.data.logins || res.data.data || res.data);
          break;
        }
        case 'sessions': {
          const res = await api.get('/admin/security/sessions');
          setSessions(res.data.sessions || res.data.data || res.data);
          break;
        }
        case 'locked': {
          const res = await api.get('/admin/security/locked-accounts');
          setLockedAccounts(res.data.accounts || res.data.data || res.data);
          break;
        }
        case 'audit': {
          const res = await api.get(`/admin/security/audit-logs?page=${page}&limit=20`);
          setAuditLogs(res.data.logs || res.data.data || res.data);
          setAuditPages(res.data.pagination?.pages || 1);
          break;
        }
        case 'windows': {
          const res = await api.get('/admin/security/access-windows');
          setSettings(res.data.data || res.data);
          break;
        }
      }
    } catch (err) {
      // Previously every one of these fetches swallowed its own failure into an empty array,
      // which was indistinguishable from "genuinely no data" — a security page silently showing
      // "no locked accounts" on a failed request is a real risk. Surface it instead.
      setError(err.response?.data?.error?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTab(); }, [tab, page, loginFilters]);

  const handleForceLogout = async (sessionId) => {
    try {
      await api.post(`/admin/security/sessions/${sessionId}/force-logout`);
      setSessions((s) => s.filter((x) => x.id !== sessionId));
      toast.success('Session terminated');
    } catch { toast.error('Failed'); }
  };

  const handleUnlock = async (accountId) => {
    try {
      await api.post(`/admin/security/locked-accounts/${accountId}/unlock`);
      setLockedAccounts((a) => a.filter((x) => x.id !== accountId));
      toast.success('Account unlocked');
    } catch { toast.error('Failed'); }
  };

  const handleSaveSettings = async () => {
    try {
      await api.put('/admin/security/access-windows', settings);
      toast.success('Saved');
    } catch { toast.error('Failed'); }
  };

  const tabs = [
    { key: 'logins', label: 'Login Activity' },
    { key: 'sessions', label: 'Active Sessions', count: sessions.length },
    { key: 'locked', label: 'Locked Accounts', count: lockedAccounts.length },
    { key: 'audit', label: 'Audit Log' },
    { key: 'windows', label: 'Access Windows' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Security Panel"
        description="Monitor login activity, active sessions, locked accounts, and audit logs."
        tone="emerald"
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {loading ? <Spinner className="py-20" /> : error ? <ErrorState message={error} onRetry={loadTab} /> : (
        <>
          {tab === 'logins' && (
            <>
              <div className="flex flex-wrap gap-3">
                <Input placeholder="User" value={loginFilters.user} onChange={(e) => setLoginFilters((f) => ({ ...f, user: e.target.value }))} className="max-w-[150px]" />
                <select value={loginFilters.outcome} onChange={(e) => setLoginFilters((f) => ({ ...f, outcome: e.target.value }))} className="px-3 py-2 border rounded text-sm"><option value="">All Outcomes</option><option value="SUCCESS">Success</option><option value="FAILURE">Failure</option></select>
              </div>
              {logins.length === 0 ? <EmptyState title="No login records" /> : (
                <Table columns={[
                  { key: 'email', label: 'User' },
                  { key: 'ip', label: 'IP' },
                  { key: 'outcome', label: 'Outcome', render: (v) => <StatusBadge status={v === 'SUCCESS' ? 'APPROVED' : 'REJECTED'} /> },
                  { key: 'userAgent', label: 'Device', render: (v) => (v || '').slice(0, 50) },
                  { key: 'timestamp', label: 'Time', render: (v) => formatDate(v) },
                ]} rows={logins} />
              )}
            </>
          )}

          {tab === 'sessions' && (
            sessions.length === 0 ? <EmptyState title="No active sessions" /> : (
              <Table columns={[
                { key: 'email', label: 'User' },
                { key: 'ip', label: 'IP' },
                { key: 'userAgent', label: 'Device', render: (v) => (v || '').slice(0, 50) },
                { key: 'createdAt', label: 'Started', render: (v) => formatDate(v) },
                { key: 'actions', label: '', render: (_, r) => <Button size="sm" variant="danger" onClick={() => handleForceLogout(r.id)}>Force Logout</Button> },
              ]} rows={sessions} />
            )
          )}

          {tab === 'locked' && (
            lockedAccounts.length === 0 ? <EmptyState title="No locked accounts" /> : (
              <Table columns={[
                { key: 'email', label: 'Email' },
                { key: 'failedAttempts', label: 'Failed Attempts' },
                { key: 'lockedAt', label: 'Locked At', render: (v) => formatDate(v) },
                { key: 'actions', label: '', render: (_, r) => <Button size="sm" onClick={() => handleUnlock(r.id)}>Unlock</Button> },
              ]} rows={lockedAccounts} />
            )
          )}

          {tab === 'audit' && (
            auditLogs.length === 0 ? <EmptyState title="No audit logs" /> : (
              <>
                <Table columns={[
                  { key: 'actor', label: 'Actor' },
                  { key: 'action', label: 'Action' },
                  { key: 'entity', label: 'Entity' },
                  { key: 'entityId', label: 'Entity ID' },
                  { key: 'timestamp', label: 'Time', render: (v) => formatDate(v) },
                  { key: 'details', label: '', render: (_, r) => r.before && r.after ? <Button size="sm" variant="outline" onClick={() => setSelectedAudit(r)}>Diff</Button> : null },
                ]} rows={auditLogs} />
                <Pagination page={page} totalPages={auditPages} onChange={setPage} />
                {selectedAudit && (
                  <Card><h3 className="text-sm font-medium mb-3">Audit Diff</h3><AuditDiffViewer before={selectedAudit.before} after={selectedAudit.after} /><Button variant="outline" size="sm" onClick={() => setSelectedAudit(null)} className="mt-2">Close</Button></Card>
                )}
              </>
            )
          )}

          {tab === 'windows' && (
            <Card>
              <div className="space-y-4 max-w-md">
                <Input label="Max Concurrent Sessions" type="number" value={settings.sessionCap} onChange={(e) => setSettings((s) => ({ ...s, sessionCap: e.target.value }))} />
                <Input label="Lockout Threshold (attempts)" type="number" value={settings.lockoutThreshold} onChange={(e) => setSettings((s) => ({ ...s, lockoutThreshold: e.target.value }))} />
                <Input label="Lockout Duration (minutes)" type="number" value={settings.lockoutDuration} onChange={(e) => setSettings((s) => ({ ...s, lockoutDuration: e.target.value }))} />
                <Button onClick={handleSaveSettings}>Save Settings</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
