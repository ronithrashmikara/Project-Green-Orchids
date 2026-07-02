'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/domain/DashboardUI';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function StatementsPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!month) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/invoices/statements?month=${month}`);
        setStatement(res.data.data);
      } catch {
        setStatement(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [month]);

  const handleDownload = async () => {
    try {
      const res = await api.get(`/invoices/statements/pdf?month=${month}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${month}.pdf`;
      a.click();
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        title="Statements"
        description="View and download your monthly account statements."
        actions={<Button variant="outline" onClick={handleDownload} disabled={!statement}>Download</Button>}
      />

      <div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
      </div>

      {loading ? <Spinner className="py-20" /> : !statement ? <EmptyState title="No statement available" /> : (
        <Card>
          <div className="space-y-4">
            <div className="flex justify-between text-sm"><span>Opening Balance</span><span>{formatLKR(statement.openingBalance || 0)}</span></div>

            {(statement.entries || []).map((entry, i) => (
              <div key={i} className="flex justify-between items-center text-sm border-t pt-2">
                <div>
                  <span className="text-gray-500">{formatDate(entry.date)}</span>
                  <span className="ml-3 text-gray-700">{entry.description}</span>
                </div>
                <span className={entry.type === 'credit' ? 'text-green-700' : 'text-red-700'}>
                  {entry.type === 'credit' ? '-' : '+'}{formatLKR(Math.abs(entry.amount))}
                </span>
              </div>
            ))}

            <div className="flex justify-between font-bold text-lg border-t pt-3">
              <span>Closing Balance</span>
              <span>{formatLKR(statement.closingBalance || 0)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
