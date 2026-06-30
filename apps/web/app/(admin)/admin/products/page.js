'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Button, Input } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { StockBand, StatusBadge } from '@/components/domain/StatusBadge';
import { formatLKR } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get(`/admin/products?${params}`);
      setProducts(res.data.products || res.data.data || res.data);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (val) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => { setSearch(val); setPage(1); }, 350));
  };

  const toggleSelect = (id) => {
    setSelected((s) => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  };

  const bulkAction = async (action) => {
    const ids = Array.from(selected);
    if (!ids.length) return toast.error('Select products');
    try {
      await api.post('/admin/products/bulk', { ids, action });
      toast.success(`${action} completed`);
      fetchProducts();
      setSelected(new Set());
    } catch { toast.error('Failed'); }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/admin/products/export/csv', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click();
    } catch { toast.error('Export failed'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/products/${deleteTarget.id}`);
      setProducts((p) => p.filter((x) => x.id !== deleteTarget.id));
      toast.success('Product deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const cols = [
    { key: 'select', label: <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())} checked={selected.size === products.length && products.length > 0} />, render: (_, r) => <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /> },
    { key: 'imageUrl', label: 'Image', render: (v) => v ? <img src={v} className="w-10 h-10 object-cover rounded" /> : '🌿' },
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'price', label: 'Price', render: (v) => formatLKR(v) },
    { key: 'stock', label: 'Stock', render: (v, r) => <div><StockBand stock={v} /><div className="text-xs text-gray-400">Reserved: {r.reserved || 0} | Avail: {(v || 0) - (r.reserved || 0)}</div></div> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'actions', label: '', render: (_, r) => (
      <div className="flex gap-1">
        <Link href={`/admin/products/${r.id}`}><Button size="sm" variant="outline">Edit</Button></Link>
        <Button size="sm" variant="ghost" onClick={() => api.post(`/admin/products/${r.id}/duplicate`).then(() => { toast.success('Duplicated'); fetchProducts(); })}>Copy</Button>
        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)}>Delete</Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Product Management</h1>
        <Link href="/admin/products/new"><Button>Add Product</Button></Link>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search products..." onChange={(e) => handleSearch(e.target.value)} className="max-w-xs" />
        <Button variant="outline" size="sm" onClick={() => bulkAction('hide')}>Hide Selected</Button>
        <Button variant="outline" size="sm" onClick={() => bulkAction('show')}>Show Selected</Button>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>Export CSV</Button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchProducts} />}
      {loading ? <Spinner className="py-20" /> : products.length === 0 ? <EmptyState title="No products" /> : (
        <div className="overflow-x-auto">
          <Table columns={cols} rows={products} />
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete product"
        message={`Delete "${deleteTarget?.name}"? All associated inventory records will also be removed. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
