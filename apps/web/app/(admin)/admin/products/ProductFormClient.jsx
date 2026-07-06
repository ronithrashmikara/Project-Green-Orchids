'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, Input, Textarea, Select } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { FileUpload } from '@/components/ui/FileUpload';
import { Spinner } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

const PRODUCT_TYPES = [
  { value: 'ORCHID', label: 'Orchid' },
  { value: 'FERTILIZER', label: 'Fertilizer' },
  { value: 'SUPPLY', label: 'Supply' },
  { value: 'OTHER', label: 'Other' },
];
const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

const emptyForm = {
  sku: '', name: '', description: '', category_id: '', supplier_id: '',
  product_type: 'ORCHID', unit_size: '', base_price: '', moq: '1',
  stock_qty: '0', reorder_level: '10', status: 'ACTIVE', bloom_video_url: '',
};

export default function ProductFormPage({ isEdit = false }) {
  const router = useRouter();
  const { id } = isEdit ? useParams() : { id: null };
  const [tab, setTab] = useState('basics');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [product, setProduct] = useState(null); // full server record once created/loaded
  const [form, setForm] = useState(emptyForm);
  const [bulkTiers, setBulkTiers] = useState([]);
  const [savingTiers, setSavingTiers] = useState(false);
  const [priceReason, setPriceReason] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [changingPrice, setChangingPrice] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then((r) => setSuppliers(r.data.data || r.data.suppliers || [])).catch(() => {});
    api.get('/products/meta/categories').then((r) => setCategories(r.data.data || [])).catch(() => {});

    if (isEdit && id) {
      api.get(`/products/${id}`).then((r) => {
        const p = r.data.data;
        setProduct(p);
        setForm({
          sku: p.sku || '', name: p.name || '', description: p.description || '',
          category_id: String(p.categoryId || ''), supplier_id: String(p.supplierId || ''),
          product_type: p.type || 'ORCHID', unit_size: p.unit || '',
          base_price: String(p.basePrice ?? ''), moq: String(p.moq || 1),
          stock_qty: String(p.stock ?? 0), reorder_level: String(p.reorderLevel ?? 10),
          status: p.status || 'ACTIVE', bloom_video_url: p.bloomVideoUrl || '',
        });
        setBulkTiers((p.bulkTiers || []).map((t) => ({ min_quantity: t.minQty, unit_price: t.price })));
        setNewPrice(String(p.basePrice ?? ''));
        setLoading(false);
      }).catch(() => { toast.error('Product not found'); router.push('/admin/products'); });
    }
  }, [isEdit, id, router]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit) {
        const payload = {
          name: form.name, description: form.description || undefined,
          category_id: Number(form.category_id), supplier_id: Number(form.supplier_id),
          product_type: form.product_type, unit_size: form.unit_size || undefined,
          moq: parseInt(form.moq, 10), reorder_level: parseInt(form.reorder_level, 10),
          status: form.status, bloom_video_url: form.bloom_video_url || null,
        };
        const res = await api.patch(`/products/${id}`, payload);
        setProduct(res.data.data);
        toast.success('Product updated');
      } else {
        const payload = {
          sku: form.sku, name: form.name, description: form.description || undefined,
          category_id: Number(form.category_id), supplier_id: Number(form.supplier_id),
          product_type: form.product_type, unit_size: form.unit_size || undefined,
          base_price: parseFloat(form.base_price), moq: parseInt(form.moq, 10),
          stock_qty: parseInt(form.stock_qty, 10), reorder_level: parseInt(form.reorder_level, 10),
          status: form.status, bloom_video_url: form.bloom_video_url || undefined,
        };
        const res = await api.post('/products', payload);
        toast.success('Product created — you can now add images and bulk pricing');
        router.push(`/admin/products/${res.data.data.id}`);
        return;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/products/${id}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const r = await api.get(`/products/${id}`);
      setProduct(r.data.data);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    try {
      await api.put(`/products/${id}/bulk-tiers`, { tiers: bulkTiers.map((t) => ({ min_quantity: Number(t.min_quantity), unit_price: Number(t.unit_price) })) });
      toast.success('Bulk pricing saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk tier rows must have strictly increasing quantities and decreasing prices');
    } finally {
      setSavingTiers(false);
    }
  };

  const handleChangePrice = async () => {
    setChangingPrice(true);
    try {
      const res = await api.post(`/products/${id}/price-change`, { new_price: parseFloat(newPrice), reason: priceReason });
      if (res.data.data?.needs_approval) toast.success('A 3rd price change in 24h needs another admin\'s approval — request queued');
      else { toast.success('Price updated'); const r = await api.get(`/products/${id}`); setProduct(r.data.data); }
      setPriceReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Price change failed');
    } finally {
      setChangingPrice(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;

  const tabs = [
    { key: 'basics', label: 'Basics' },
    { key: 'media', label: 'Media', disabled: !isEdit },
    { key: 'pricing', label: 'Pricing', disabled: !isEdit },
    { key: 'inventory', label: 'Inventory' },
    { key: 'visibility', label: 'Visibility' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isEdit ? `Edit Product — ${form.name}` : 'New Product'}</h1>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Card>
        {tab === 'basics' && (
          <div className="space-y-4 grid grid-cols-2 gap-4">
            <Input label="SKU" value={form.sku} onChange={(e) => update('sku', e.target.value)} disabled={isEdit} required />
            <Input label="Name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
            <Select label="Type" value={form.product_type} onChange={(e) => update('product_type', e.target.value)} options={PRODUCT_TYPES} />
            <Select label="Category" value={form.category_id} onChange={(e) => update('category_id', e.target.value)} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
            <Select label="Supplier" value={form.supplier_id} onChange={(e) => update('supplier_id', e.target.value)} options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))} />
            <Input label="Unit Size" placeholder="e.g. 1kg bag, single plant pot 12cm" value={form.unit_size} onChange={(e) => update('unit_size', e.target.value)} />
            <Input label="MOQ" type="number" min="1" value={form.moq} onChange={(e) => update('moq', e.target.value)} />
            {!isEdit && <Input label="Base Price (LKR)" type="number" step="0.01" min="0.01" value={form.base_price} onChange={(e) => update('base_price', e.target.value)} required />}
            {form.product_type === 'ORCHID' && (
              <Input label="Bloom Video URL" placeholder="Cloudinary bloom time-lapse (optional)" value={form.bloom_video_url} onChange={(e) => update('bloom_video_url', e.target.value)} className="col-span-2" />
            )}
            <div className="col-span-2"><Textarea label="Description" value={form.description} onChange={(e) => update('description', e.target.value)} /></div>
          </div>
        )}

        {tab === 'media' && isEdit && (
          <div className="space-y-4">
            <FileUpload label="Upload Product Image" onUpload={handleImageUpload} />
            {(product?.images || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.images.map((img, i) => <img key={i} src={img} alt={`${form.name || 'Product'} image ${i + 1}`} className="w-24 h-24 object-cover rounded border" />)}
              </div>
            ) : <p className="text-sm text-gray-500">No images yet.</p>}
          </div>
        )}

        {tab === 'pricing' && isEdit && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-2">Current Price: LKR {Number(product?.basePrice || 0).toLocaleString()}</h4>
              <p className="text-xs text-gray-500 mb-3">Price changes are governed: two changes per rolling 24h are applied immediately; a third requires a different admin's approval.</p>
              <div className="grid grid-cols-2 gap-3 items-end">
                <Input label="New Price (LKR)" type="number" step="0.01" min="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                <Input label="Reason" value={priceReason} onChange={(e) => setPriceReason(e.target.value)} placeholder="Required for the approval queue" />
              </div>
              <Button className="mt-3" onClick={handleChangePrice} loading={changingPrice} disabled={!newPrice || Number(newPrice) === Number(product?.basePrice)}>Change Price</Button>
            </div>
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Bulk Pricing Tiers</h4>
              <p className="text-xs text-gray-500 mb-2">Quantities must strictly increase and prices must strictly decrease down the list.</p>
              {bulkTiers.map((tier, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input placeholder="Min Qty" type="number" value={tier.min_quantity} onChange={(e) => { const bt = [...bulkTiers]; bt[idx] = { ...bt[idx], min_quantity: e.target.value }; setBulkTiers(bt); }} />
                  <Input placeholder="Unit Price" type="number" step="0.01" value={tier.unit_price} onChange={(e) => { const bt = [...bulkTiers]; bt[idx] = { ...bt[idx], unit_price: e.target.value }; setBulkTiers(bt); }} />
                  <Button variant="ghost" size="sm" onClick={() => setBulkTiers(bulkTiers.filter((_, i) => i !== idx))}>Remove</Button>
                </div>
              ))}
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => setBulkTiers([...bulkTiers, { min_quantity: '', unit_price: '' }])}>+ Add Tier</Button>
                <Button size="sm" onClick={handleSaveTiers} loading={savingTiers}>Save Tiers</Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="space-y-4 grid grid-cols-2 gap-4">
            {!isEdit && <Input label="Opening Stock" type="number" min="0" value={form.stock_qty} onChange={(e) => update('stock_qty', e.target.value)} />}
            {isEdit && (
              <div className="col-span-2 text-sm text-gray-600 bg-gray-50 rounded p-3">
                Current stock: <strong>{product?.stock ?? 0}</strong> (reserved {product?.reserved ?? 0}, available {product?.available ?? 0}).
                Stock changes go through the movement dialog on the product list (never a bare number edit) so every change is audited.
              </div>
            )}
            <Input label="Reorder Level" type="number" min="0" value={form.reorder_level} onChange={(e) => update('reorder_level', e.target.value)} />
          </div>
        )}

        {tab === 'visibility' && (
          <div className="space-y-4">
            <Select label="Status" value={form.status} onChange={(e) => update('status', e.target.value)} options={STATUSES} />
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => router.push('/admin/products')}>{isEdit ? 'Back to List' : 'Cancel'}</Button>
          {tab !== 'media' && tab !== 'pricing' && <Button onClick={handleSave} loading={saving}>{isEdit ? 'Save Changes' : 'Create Product'}</Button>}
        </div>
      </Card>
    </div>
  );
}
