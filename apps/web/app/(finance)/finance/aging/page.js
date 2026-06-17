'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function AgingReportPage() {
  const searchParams = useSearchParams();
  const bucketParam = searchParams.get('bucket');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const params = bucketParam ? `?bucket=${bucketParam}` : '';
      const res = await api.get(`/finance/aging${params}`).catch(() => ({ data: { invoices: [], summary: {} } }));
      setData(res.data);
      setLoading(false);
    })();
  }, [bucketParam]);

  const handleExportCSV = async () => {
    try {
      const params = bucketParam ? `?bucket=${bucketParam}&format=csv` : '?format=csv';
      const res = await api.get(`/finance/aging/export${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'aging-report.csv'; a.click();
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <Spinner className="py-20" />;

  const d = data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Aging Report {bucketParam ? `(${bucketParam} days)` : ''}</h1>
        <Button variant="outline" onClick={handleExportCSV}>Export CSV</Button>
      </div>

      {d.summary && (
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(d.summary).map(([key, val]) => (
            <Card key={key} className="text-center">
              <div className="text-2xl font-bold">{typeof val === 'number' ? formatLKR(val) : val}</div>
              <p className="text-xs text-gray-500 mt-1">{key.replace(/_/g, ' ')}</p>
            </Card>
          ))}
        </div>
      )}

      {!d.invoices?.length ? <EmptyState title="No aging data" /> : (
        <Table
          columns={[
            { key: 'invoiceNo', label: 'Invoice #' },
            { key: 'buyerName', label: 'Buyer' },
            { key: 'dueDate', label: 'Due Date', render: (v) => formatDate(v) },
            { key: 'total', label: 'Amount', render: (v) => formatLKR(v) },
            { key: 'balance', label: 'Outstanding', render: (v) => formatLKR(v) },
            { key: 'daysOverdue', label: 'Days Overdue', render: (v) => <span className={v > 60 ? 'text-red-600 font-medium' : v > 30 ? 'text-yellow-600' : ''}>{v}</span> },
          ]}
          rows={d.invoices}
        />
      )}
    </div>
  );
}
