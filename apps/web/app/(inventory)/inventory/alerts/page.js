'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/domain/DashboardUI';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    const res = await api.get('/inventory/alerts').catch(() => ({ data: [] }));
    setAlerts(res.data.alerts || res.data.data || res.data);
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const handleAcknowledge = async (id) => {
    try {
      await api.patch(`/inventory/alerts/${id}/ack`);
      setAlerts((a) => a.map((x) => x.id === id ? { ...x, acknowledged: true } : x));
      toast.success('Acknowledged');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Stock Alerts"
        description="Review low-stock and out-of-stock alerts and acknowledge them once addressed."
        tone="amber"
      />
      {loading ? <Spinner className="py-20" /> : alerts.length === 0 ? <EmptyState title="No alerts" /> : (
        <Table
          columns={[
            { key: 'productName', label: 'Product' },
            { key: 'type', label: 'Type' },
            { key: 'message', label: 'Message' },
            { key: 'createdAt', label: 'Date', render: (v) => formatDate(v) },
            { key: 'actions', label: '', render: (_, r) => !r.acknowledged ? <Button size="sm" onClick={() => handleAcknowledge(r.id)}>Acknowledge</Button> : <span className="text-xs text-green-600">✓ Acknowledged</span> },
          ]}
          rows={alerts}
        />
      )}
    </div>
  );
}
