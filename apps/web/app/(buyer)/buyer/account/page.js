'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TierBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setChangingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      toast.success('Password changed');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await api.get('/auth/me/sessions');
      setSessions(res.data.data || []);
    } catch {}
    setShowSessions(true);
  };

  const signOutOthers = async () => {
    try {
      await api.post('/auth/me/sessions/revoke-others');
      toast.success('Signed out other devices');
      loadSessions();
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader tone="violet" title="Account Settings" description="Manage your business profile, tier benefits, password, and active sessions." />

      {/* Profile */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Business Profile</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Business Name</dt><dd className="font-medium">{user?.businessName}</dd></div>
          <div><dt className="text-gray-500">Registration No</dt><dd className="font-medium">{user?.registrationNo}</dd></div>
          <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{user?.email}</dd></div>
          <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{user?.phone}</dd></div>
          <div><dt className="text-gray-500">Address</dt><dd className="font-medium">{user?.address}</dd></div>
          <div><dt className="text-gray-500">Member Since</dt><dd className="font-medium">{formatDate(user?.createdAt)}</dd></div>
        </dl>
      </Card>

      {/* Tier & Benefits */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Tier & Benefits</h3>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-gray-500">Current Tier:</span>
          <TierBadge tier={user?.tier || 'SILVER'} />
        </div>
        <div className="text-sm space-y-1">
          {user?.discount > 0 && <p>• {user.discount}% discount on all products</p>}
          {user?.creditLimit > 0 && <p>• Credit limit: LKR {user.creditLimit.toLocaleString()}</p>}
          {user?.paymentTerms && <p>• Payment terms: {user.paymentTerms}</p>}
        </div>
      </Card>

      {/* Password Change */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Change Password</h3>
        <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
          <Input type="password" label="Current Password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
          <Input type="password" label="New Password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
          <Input type="password" label="Confirm Password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
          <Button type="submit" loading={changingPw} size="sm">Change Password</Button>
        </form>
      </Card>

      {/* Sessions */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Active Sessions</h3>
        {!showSessions ? (
          <Button variant="outline" size="sm" onClick={loadSessions}>View Sessions</Button>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="text-sm flex justify-between py-1 border-b">
                <span>{s.device_info || 'Unknown device'} <span className="text-gray-400">({s.ip_address})</span></span>
                <span className="text-gray-500">{formatDate(s.created_at)}</span>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={signOutOthers}>Sign Out Other Devices</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
