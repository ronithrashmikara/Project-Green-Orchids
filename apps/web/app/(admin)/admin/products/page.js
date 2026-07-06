'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Button, Input, Select, Textarea } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Table } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { StockBand, StatusBadge } from '@/components/domain/StatusBadge';
import { PageHeader } from '@/components/domain/DashboardUI';
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
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'RECEIVE', quantity: '', note: '' });
  const [adjusting, setAdjusting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get(`/products?${params}`);
      const raw = res.data.data || res.data.products || (Array.isArray(res.data) ? res.data : []);
      setProducts(raw.map((p) => ({
        ...p,
        imageUrl: p.primary_image || p.imageUrl || null,
        supplierName: p.supplier_name || p.supplierName || '',
        price: p.base_price || p.price || 0,
        stock: p.stock_qty != null ? p.stock_qty : (p.stock ?? 0),
        reserved: p.reserved_qty != null ? p.reserved_qty : (p.reserved ?? 0),
        category: p.category_name || p.category || '',
      })));
      setTotalPages(res.data.pagination?.pages || res.data.totalPages || 1);
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
      await api.post('/products/bulk', { ids, action });
      toast.success(`${action} completed`);
      fetchProducts();
      setSelected(new Set());
    } catch { toast.error('Failed'); }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/products/export/csv', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click();
    } catch { toast.error('Export failed'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      setProducts((p) => p.filter((x) => x.id !== deleteTarget.id));
      toast.success('Product deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const openAdjust = (product) => {
    setAdjustForm({ type: 'RECEIVE', quantity: '', note: '' });
    setAdjustTarget(product);
  };

  const handleAdjustStock = async () => {
    const quantity = parseInt(adjustForm.quantity, 10);
    if (!quantity || quantity < 1) return toast.error('Enter a quantity of at least 1');
    setAdjusting(true);
    try {
      await api.post(`/products/${adjustTarget.id}/stock-adjustment`, {
        type: adjustForm.type, quantity, note: adjustForm.note || undefined,
      });
      toast.success('Stock adjusted');
      setAdjustTarget(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  };

  const cols = [
    { key: 'select', label: <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())} checked={selected.size === products.length && products.length > 0} />, render: (_, r) => <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /> },
    { key: 'imageUrl', label: 'Image', render: (v, r) => v ? <img src={v} alt={r.name} className="w-10 h-10 object-cover rounded" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.insertAdjacentText('afterend', '🌿'); }} /> : '🌿' },
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
        <Button size="sm" variant="ghost" onClick={() => openAdjust(r)}>Adjust Stock</Button>
        <Button size="sm" variant="ghost" onClick={() => api.post(`/products/${r.id}/duplicate`).then(() => { toast.success('Duplicated'); fetchProducts(); }).catch(() => toast.error('Duplicate not supported'))}>Copy</Button>
        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)}>Delete</Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Product Management"
        description="Manage the product catalogue, stock levels, and listing visibility."
        actions={<Link href="/admin/products/new"><Button>Add Product</Button></Link>}
        tone="emerald"
      />

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
        message={`Discontinue "${deleteTarget?.name}"? It will be marked DISCONTINUED and hidden from the buyer catalogue. Existing orders and stock history are preserved.`}
        confirmLabel="Discontinue"
        variant="danger"
        requireTypedConfirmation={deleteTarget?.sku}
      />

      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title="Adjust Stock" size="sm">
        {adjustTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{adjustTarget.name} · Current stock: <strong>{adjustTarget.stock}</strong></p>
            <Select
              label="Adjustment type"
              value={adjustForm.type}
              onChange={(e) => setAdjustForm((f) => ({ ...f, type: e.target.value }))}
              options={[
                { value: 'RECEIVE', label: 'Receive stock (+)' },
                { value: 'RESTOCK', label: 'Restock (+)' },
                { value: 'DEDUCT', label: 'Deduct (-)' },
                { value: 'WRITE_OFF', label: 'Write off / damaged (-)' },
                { value: 'RESERVATION_CONVERT', label: 'Convert reservation (-)' },
              ]}
            />
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={adjustForm.quantity}
              onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: e.target.value }))}
            />
            <Textarea
              label="Note (optional)"
              value={adjustForm.note}
              onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Reason for this adjustment"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancel</Button>
              <Button onClick={handleAdjustStock} loading={adjusting}>Apply Adjustment</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
