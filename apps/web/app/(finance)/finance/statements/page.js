'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Button, Input, Select } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function StatementsPage() {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/buyers?limit=100').then((r) => {
      const rows = r.data.data || [];
      setBuyers(rows.map((b) => ({ id: b.id, businessName: b.business_name, email: b.email })));
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedBuyer) { toast.error('Select a buyer'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/invoices/statements?buyerId=${selectedBuyer}&month=${month}`);
      setStatement(res.data.data || res.data);
    } catch {
      toast.error('Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/invoices/statements/pdf?buyerId=${selectedBuyer}&month=${month}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `statement-${month}.pdf`; a.click();
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        tone="sky"
        title="Statement Generator"
        description="Generate and download monthly account statements for a buyer."
      />
      <div className="flex gap-4 items-end">
        <Select label="Buyer" value={selectedBuyer} onChange={(e) => setSelectedBuyer(e.target.value)} options={[{ value: '', label: 'Select buyer...' }, ...buyers.map((b) => ({ value: b.id, label: b.businessName || b.email }))]} className="max-w-sm" />
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[200px]" />
        <Button onClick={handleGenerate} loading={loading}>Generate</Button>
        {statement && <Button variant="outline" onClick={handleDownload}>Download PDF</Button>}
      </div>
      {loading && <Spinner className="py-10" />}
      {statement && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-gray-700">Statement for {statement.month}/{statement.year}</h3>
          <div className="bg-white rounded border p-4 space-y-2 text-sm">
            <div className="flex justify-between border-b py-1 text-gray-500">
              <span>Opening balance</span>
              <span>{formatLKR(statement.openingBalance)}</span>
            </div>
            {statement.entries.length === 0 ? (
              <p className="text-gray-400 py-4 text-center">No activity in this period</p>
            ) : statement.entries.map((e, i) => (
              <div key={i} className="flex justify-between border-b py-1">
                <span>{e.description}</span>
                <span className={e.type === 'credit' ? 'text-green-700' : 'text-red-700'}>{e.type === 'credit' ? '-' : '+'}{formatLKR(e.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2"><span>Closing balance</span><span>{formatLKR(statement.closingBalance)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
