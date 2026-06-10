'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cartStore';
import { Button } from '@/components/ui/Button';
import { PriceBlock, StockBand, TierBadge } from '@/components/domain/StatusBadge';
import { Spinner, ErrorState } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { formatLKR } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/products/${id}`);
        const p = res.data;
        setProduct(p);
        setQty(p.moq || 1);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Spinner className="py-20" />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!product) return <ErrorState message="Product not found" />;

  const images = product.images?.length ? product.images : [product.imageUrl || ''];
  const moq = product.moq || 1;
  const tierPrice = product.tierPrice || product.price;
  const bulkTiers = product.bulkTiers || [];

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-sm text-green-700 hover:underline">&larr; Back to Catalogue</button>
      <div className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
            {images[activeImage] ? (
              <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">🌿</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} className={`w-16 h-16 rounded border-2 ${activeImage === i ? 'border-green-700' : 'border-gray-200'}`}>
                  {img ? <img src={img} className="w-full h-full object-cover rounded" /> : <span>🌿</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-sm text-gray-500">{product.sku} &middot; {product.category} &middot; {product.type}</p>
          </div>

          <StockBand stock={product.stock} />

          <PriceBlock basePrice={product.basePrice || product.price} tierPrice={tierPrice} discount={product.discount} tier={user?.tier} />

          {/* Bulk Tier Table */}
          {bulkTiers.length > 0 && (
            <Card>
              <h4 className="text-sm font-medium mb-2">Bulk Pricing Tiers</h4>
              <table className="w-full text-sm">
                <thead><tr><th className="text-left py-1">Quantity</th><th className="text-right py-1">Price/Unit</th></tr></thead>
                <tbody>
                  {bulkTiers.map((bt, i) => (
                    <tr key={i} className={`border-t ${qty >= bt.minQty ? 'bg-green-50 font-medium' : ''}`}>
                      <td className="py-1">{bt.minQty}+</td>
                      <td className="text-right py-1">{formatLKR(bt.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {product.supplierName && (
            <p className="text-sm text-gray-600">Supplier: {product.supplierName} {product.leadTime ? `(Lead time: ${product.leadTime} days)` : ''}</p>
          )}

          {/* MOQ-aware qty stepper */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-600">Quantity (min {moq}):</label>
            <div className="flex items-center border rounded">
              <button onClick={() => setQty(Math.max(moq, qty - 1))} className="px-3 py-2 hover:bg-gray-100">−</button>
              <span className="px-4 py-2 min-w-[3rem] text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-3 py-2 hover:bg-gray-100">+</button>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              onClick={() => { addItem({ productId: product.id, name: product.name, price: product.price, tierPrice, quantity: qty, imageUrl: product.imageUrl, category: product.category, stock: product.stock }); toast.success('Added to cart'); }}
              disabled={product.stock <= 0}
              size="lg"
            >
              {product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push('/buyer/rfq/new')}>
              Request Quote
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
