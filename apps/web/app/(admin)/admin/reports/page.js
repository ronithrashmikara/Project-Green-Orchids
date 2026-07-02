'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChartContainer, KpiCard } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
import { Spinner } from '@/components/ui/Spinner';
import { formatLKR } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#2D6A4F', '#52B788', '#40916C', '#95D5B2', '#1B4332'];

export default function ReportsPage() {
  const [tab, setTab] = useState('sales');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setLoading(true);
    (async () => {
      const params = new URLSearchParams({ view: tab });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get(`/reports?${params}`).catch(() => ({ data: { series: [], summary: {} } }));
      setData(res.data);
      setLoading(false);
    })();
  }, [tab, dateFrom, dateTo]);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({ view: tab, format: 'csv' });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get(`/reports/export?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `report-${tab}.csv`; a.click();
    } catch { toast.error('Export failed'); }
  };

  const tabs = [
    { key: 'sales', label: 'Sales Trend' },
    { key: 'category', label: 'Category' },
    { key: 'top_products', label: 'Top Products' },
    { key: 'buyers', label: 'Buyers' },
    { key: 'credit_risk', label: 'Credit Risk' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'returns', label: 'Returns' },
  ];

  const renderChart = () => {
    if (!data?.series?.length) return <p className="text-center text-gray-500 py-8">No data available</p>;
    const series = data.series;

    switch (tab) {
      case 'sales':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v) => formatLKR(v)} /><Legend /><Line type="monotone" dataKey="value" stroke="#2D6A4F" name="Sales" /></LineChart>
          </ResponsiveContainer>
        );
      case 'category':
      case 'top_products':
      case 'suppliers':
      case 'returns':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v) => formatLKR(v)} /><Legend /><Bar dataKey="value" fill="#52B788" /></BarChart>
          </ResponsiveContainer>
        );
      case 'buyers':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v) => formatLKR(v)} /><Legend /><Bar dataKey="revenue" fill="#2D6A4F" name="Revenue" /><Bar dataKey="orders" fill="#52B788" name="Orders" /></BarChart>
          </ResponsiveContainer>
        );
      case 'credit_risk':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart><Pie data={series} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={150} label><Cell fill={COLORS[0]} /><Cell fill={COLORS[1]} /><Cell fill={COLORS[2]} /></Pie><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer>
        );
      case 'inventory':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="stock" fill="#2D6A4F" name="Stock" /><Bar dataKey="turnover" fill="#52B788" name="Turnover" /></BarChart>
          </ResponsiveContainer>
        );
      default:
        return <p className="text-center text-gray-500 py-8">Select a view</p>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="BI Dashboard"
        description="Explore sales, inventory, and buyer analytics across the platform."
        actions={<Button variant="outline" size="sm" onClick={handleExportCSV}>Export CSV</Button>}
        tone="emerald"
      />

      <div className="flex gap-3">
        <DatePicker label="From" value={dateFrom} onChange={setDateFrom} />
        <DatePicker label="To" value={dateTo} onChange={setDateTo} />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {data?.summary && (
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(data.summary).map(([key, val]) => {
            const isMoney = /revenue|spend|exposure/i.test(key);
            return (
              <KpiCard key={key} title={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} value={typeof val === 'number' && isMoney ? formatLKR(val) : val} />
            );
          })}
        </div>
      )}

      {loading ? <Spinner className="py-20" /> : (
        <ChartContainer title={tabs.find((t) => t.key === tab)?.label}>{renderChart()}</ChartContainer>
      )}
    </div>
  );
}
