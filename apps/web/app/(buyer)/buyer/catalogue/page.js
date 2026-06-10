'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cartStore';
import { Input } from '@/components/ui/Button';
import { ProductCard } from '@/components/domain/ProductCard';
import { Spinner, EmptyState, ErrorState } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

export default function BuyerCataloguePage() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ type: '', category: '', supplier: '', availability: '', search: '', sort: '' });
  const [types, setTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debounceTimer, setDebounceTimer] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filters.type) params.set('type', filters.type);
      if (filters.category) params.set('category', filters.category);
      if (filters.supplier) params.set('supplier', filters.supplier);
      if (filters.availability) params.set('availability', filters.availability);
      if (filters.search) params.set('search', filters.search);
      if (filters.sort) params.set('sort', filters.sort);
      const res = await api.get(`/products/buyer?${params}`);
      setProducts(res.data.products || res.data.data || res.data);
      setTotalPages(res.data.totalPages || Math.ceil((res.data.total || res.data.length) / 20));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    api.get('/products/types-and-categories').then((r) => {
      setTypes(r.data.types || []);
      setCategories(r.data.categories || []);
      setSuppliers(r.data.suppliers || []);
    }).catch(() => {});
  }, []);

  const handleSearch = (value) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => setFilters((f) => ({ ...f, search: value })), 350));
  };

  const handleAddToCart = async (product) => {
    try {
      addItem({
        productId: product.id,
        name: product.name,
        price: product.basePrice,
        tierPrice: product.tierPrice,
        quantity: product.moq || 1,
        imageUrl: product.imageUrl,
        category: product.category,
        stock: product.stock,
      });
      toast.success(`${product.name} added to cart`);
    } catch {
      toast.error('Failed to add item');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Catalogue</h1>
      {user?.tier && (
        <div className="text-sm bg-green-50 text-green-700 px-4 py-2 rounded-lg">
          Current tier: <strong>{user.tier}</strong>
          {user.discount ? ` (${user.discount}% discount applied to all prices)` : ''}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search..." onChange={(e) => handleSearch(e.target.value)} className="max-w-xs" />
        <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.supplier} onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s.id || s} value={s.id || s}>{s.name || s}</option>)}
        </select>
        <select value={filters.availability} onChange={(e) => setFilters((f) => ({ ...f, availability: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Availability</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW">Low Stock</option>
          <option value="OUT">Out of Stock</option>
        </select>
        <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Default</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name_asc">Name: A-Z</option>
          <option value="name_desc">Name: Z-A</option>
        </select>
      </div>

      {error && <ErrorState message={error} onRetry={fetchProducts} />}

      {loading ? (
        <Spinner className="py-20" />
      ) : products.length === 0 ? (
        <EmptyState title="No products found" description="Try adjusting your search or filters" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                showPrices={true}
                tier={user?.tier}
                onView={() => router.push(`/buyer/catalogue/${p.id}`)}
                onAddToCart={() => handleAddToCart(p)}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1 text-sm rounded ${page === i + 1 ? 'bg-green-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
