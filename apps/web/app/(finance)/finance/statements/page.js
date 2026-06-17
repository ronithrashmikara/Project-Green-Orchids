'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button, Input, Select } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { formatLKR, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function StatementsPage() {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/admin/buyers?limit=100').then((r) => setBuyers(r.data.buyers || r.data.data || r.data)).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedBuyer) { toast.error('Select a buyer'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/finance/statements?buyerId=${selectedBuyer}&month=${month}`);
      setStatement(res.data);
    } catch { toast.error('Failed to generate'); } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/finance/statements/pdf?buyerId=${selectedBuyer}&month=${month}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `statement-${month}.pdf`; a.click();
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Statement Generator</h1>
      <div className="flex gap-4 items-end">
        <Select label="Buyer" value={selectedBuyer} onChange={(e) => setSelectedBuyer(e.target.value)} options={buyers.map((b) => ({ value: b.id, label: b.businessName || b.email }))} className="max-w-sm" />
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[200px]" />
        <Button onClick={handleGenerate} loading={loading}>Generate</Button>
        {statement && <Button variant="outline" onClick={handleDownload}>Download PDF</Button>}
      </div>
      {statement && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-gray-700">Statement for {month}</h3>
          <div className="bg-white rounded border p-4 space-y-2 text-sm">
            {(statement.entries || []).map((e, i) => (
              <div key={i} className="flex justify-between border-b py-1">
                <span>{formatDate(e.date)} - {e.description}</span>
                <span className={e.type === 'credit' ? 'text-green-700' : 'text-red-700'}>{e.type === 'credit' ? '+' : '-'}{formatLKR(Math.abs(e.amount))}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2"><span>Balance</span><span>{formatLKR(statement.closingBalance)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
