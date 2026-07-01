'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

function normalizeRow(r) {
  return {
    buyerId: r.buyer_id,
    buyerName: r.buyer_name,
    invoiceCount: Number(r.invoice_count),
    totalOutstanding: Number(r.total_outstanding),
    bucket0_30: Number(r.bucket_0_30),
    bucket30_60: Number(r.bucket_30_60),
    bucket60_90: Number(r.bucket_60_90),
    bucket90plus: Number(r.bucket_90plus),
  };
}

export default function AgingReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.get('/invoices/aging').catch(() => ({ data: { data: [] } }));
      setRows((res.data.data || []).map(normalizeRow));
      setLoading(false);
    })();
  }, []);

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/invoices/aging?format=csv', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'aging-report.csv'; a.click();
    } catch { toast.error('Export failed'); }
  };

  const totals = rows.reduce((acc, r) => ({
    outstanding: acc.outstanding + r.totalOutstanding,
    b0_30: acc.b0_30 + r.bucket0_30,
    b30_60: acc.b30_60 + r.bucket30_60,
    b60_90: acc.b60_90 + r.bucket60_90,
    b90plus: acc.b90plus + r.bucket90plus,
  }), { outstanding: 0, b0_30: 0, b30_60: 0, b60_90: 0, b90plus: 0 });

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      <PageHeader
        tone="sky"
        title="Aging Report"
        description="Outstanding balances by buyer, broken down by how overdue they are."
        actions={<Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>}
      />

      <div className="grid grid-cols-5 gap-4">
        <Card className="text-center"><div className="text-2xl font-bold">{formatLKR(totals.outstanding)}</div><p className="text-xs text-gray-500 mt-1">Total Outstanding</p></Card>
        <Card className="text-center"><div className="text-2xl font-bold">{formatLKR(totals.b0_30)}</div><p className="text-xs text-gray-500 mt-1">0-30 days</p></Card>
        <Card className="text-center"><div className="text-2xl font-bold">{formatLKR(totals.b30_60)}</div><p className="text-xs text-gray-500 mt-1">30-60 days</p></Card>
        <Card className="text-center"><div className="text-2xl font-bold">{formatLKR(totals.b60_90)}</div><p className="text-xs text-gray-500 mt-1">60-90 days</p></Card>
        <Card className="text-center"><div className="text-2xl font-bold text-red-600">{formatLKR(totals.b90plus)}</div><p className="text-xs text-gray-500 mt-1">90+ days</p></Card>
      </div>

      {rows.length === 0 ? <EmptyState title="No outstanding balances" /> : (
        <Table
          columns={[
            { key: 'buyerName', label: 'Buyer' },
            { key: 'invoiceCount', label: 'Open Invoices' },
            { key: 'totalOutstanding', label: 'Total', render: (v) => formatLKR(v) },
            { key: 'bucket0_30', label: '0-30d', render: (v) => formatLKR(v) },
            { key: 'bucket30_60', label: '30-60d', render: (v) => formatLKR(v) },
            { key: 'bucket60_90', label: '60-90d', render: (v) => formatLKR(v) },
            { key: 'bucket90plus', label: '90+d', render: (v) => <span className={v > 0 ? 'text-red-600 font-medium' : ''}>{formatLKR(v)}</span> },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
