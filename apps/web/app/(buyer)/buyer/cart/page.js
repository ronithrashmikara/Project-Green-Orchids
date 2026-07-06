'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cartStore';
import { useAuth } from '@/lib/auth';
import { Button, Input, Textarea } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CartItem } from '@/components/domain/ProductCard';
import { CreditBar } from '@/components/domain/StatusBadge';
import { EmptyState } from '@/components/ui/Spinner';
import { formatLKR } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/domain/DashboardUI';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, subtotal } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ poReference: '', note: '' });
  const [placing, setPlacing] = useState(false);
  const [creditInfo, setCreditInfo] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const confirmRemove = (productId) => {
    const item = items.find((i) => i.productId === productId);
    setRemoveTarget(item || { productId });
  };
  const handleConfirmRemove = () => {
    if (removeTarget) removeItem(removeTarget.productId);
    setRemoveTarget(null);
  };

  // Compute savings
  const baseTotal = items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0);
  const tierTotal = items.reduce((sum, i) => sum + (i.tierPrice || i.price || 0) * i.quantity, 0);
  const savings = baseTotal - tierTotal;

  const handleCheckout = async () => {
    setPlacing(true);
    try {
      const res = await api.post('/orders', { notes: checkoutForm.note || undefined });
      toast.success('Order placed successfully!');
      clearCart();
      router.push(`/buyer/orders/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
      setShowCheckout(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader tone="violet" title="Cart" description="Review items before checkout and adjust quantities as needed." />
        <EmptyState title="Your cart is empty" description="Browse the catalogue to add products" action={<Button onClick={() => router.push('/buyer/catalogue')}>Browse Catalogue</Button>} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        tone="violet"
        title={`Cart (${items.length} items)`}
        description="Review items before checkout and adjust quantities as needed."
        actions={<button onClick={clearCart} className="text-sm text-red-600 hover:underline">Clear cart</button>}
      />

      {/* Stock warnings */}
      {items.filter((i) => i.stock != null && i.quantity > i.stock).map((i) => (
        <div key={i.productId} className="bg-orange-50 text-orange-700 text-sm p-3 rounded-lg">
          ⚠ {i.name}: Requested {i.quantity}, only {i.stock} available
        </div>
      ))}

      {/* Credit impact preview */}
      {creditInfo && (
        <Card>
          <CreditBar used={creditInfo.used + tierTotal} limit={creditInfo.limit} />
        </Card>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <CartItem
            key={item.productId}
            item={item}
            tier={user?.tier}
            onUpdateQty={updateQuantity}
            onRemove={confirmRemove}
          />
        ))}
      </div>

      <Card className="text-right space-y-2">
        {savings > 0 && (
          <p className="text-sm text-green-600">You saved {formatLKR(savings)} vs base prices</p>
        )}
        <p className="text-lg font-bold">Total: {formatLKR(tierTotal)}</p>
        <Button size="lg" onClick={() => setShowCheckout(true)}>Proceed to Checkout</Button>
      </Card>

      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title="Checkout" size="md">
        <div className="space-y-4">
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            <p>Payment Terms: <strong>{user?.paymentTerms || 'Net 30'}</strong></p>
          </div>
          <Input label="PO Reference" value={checkoutForm.poReference} onChange={(e) => setCheckoutForm((f) => ({ ...f, poReference: e.target.value }))} placeholder="Optional" />
          <Textarea label="Order Note" value={checkoutForm.note} onChange={(e) => setCheckoutForm((f) => ({ ...f, note: e.target.value }))} placeholder="Any special instructions" />
          <div className="text-right space-y-2">
            <p className="text-lg font-bold">Total: {formatLKR(tierTotal)}</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCheckout(false)}>Cancel</Button>
              <Button onClick={handleCheckout} loading={placing}>Place Order</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
        title="Remove item from cart?"
        message={removeTarget ? `Remove "${removeTarget.name || 'this item'}" from your cart?` : ''}
        confirmLabel="Remove"
        variant="warning"
      />
    </div>
  );
}
