'use client';

import { cn, formatLKR } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { StockBand, PriceBlock, TierBadge, StatusBadge } from './StatusBadge';

export function ProductCard({ product, onAddToCart, onView, showPrices = false, tier, className }) {
  const outOfStock = product.stock != null && product.stock <= 0;
  return (
    <div className={cn('group overflow-hidden rounded-3xl border border-white/70 bg-white/82 shadow-xl shadow-green-950/5 ring-1 ring-slate-900/5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-950/10', className)}>
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-green-50 via-white to-pink-50">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl text-green-700/35">🌿</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/45 to-transparent" />
        {product.tier && <div className="absolute left-3 top-3"><TierBadge tier={product.tier} /></div>}
        <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-700 shadow-sm backdrop-blur">{product.sku || product.type || 'ORCHID'}</div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h4 className="truncate text-sm font-black text-slate-950">{product.name}</h4>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{product.category || product.type}</p>
        </div>
        {showPrices ? (
          <PriceBlock basePrice={product.basePrice} tierPrice={product.tierPrice || product.basePrice} discount={product.discount} tier={tier} />
        ) : (
          <p className="rounded-2xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">Sign in to view wholesale prices</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <StockBand stock={product.stock} />
          {product.moq > 1 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">MOQ: {product.moq}</span>}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={() => onView?.(product)} variant="outline">View</Button>
          <Button size="sm" className="flex-1" onClick={() => onAddToCart?.(product)} disabled={outOfStock}>{outOfStock ? 'Out' : 'Add'}</Button>
        </div>
        {outOfStock && <p className="text-center text-xs font-semibold text-orange-600"><a href="#" className="underline">Request via RFQ</a></p>}
      </div>
    </div>
  );
}

export function CartItem({ item, onUpdateQty, onRemove, tier }) {
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-b-0">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 to-pink-50 shadow-inner">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">🌿</div>}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-black text-slate-900">{item.name}</h4>
        <p className="text-xs text-slate-500">{item.category}</p>
        {item.stockWarning && <p className="mt-1 text-xs font-semibold text-orange-600">⚠ Only {item.stock} left</p>}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button className="px-2 py-1 text-sm hover:bg-slate-50" onClick={() => onUpdateQty(item.productId, item.quantity - 1)}>−</button>
            <span className="min-w-[2rem] px-2 py-1 text-center text-sm font-semibold">{item.quantity}</span>
            <button className="px-2 py-1 text-sm hover:bg-slate-50" onClick={() => onUpdateQty(item.productId, item.quantity + 1)}>+</button>
          </div>
          <span className="text-sm font-black text-green-700">{formatLKR((item.tierPrice || item.price) * item.quantity)}</span>
        </div>
      </div>
      <button onClick={() => onRemove(item.productId)} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Remove item">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );
}

export function ProductTable({ products = [], onSelect, selectedIds = [], className }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-white/70 bg-white/80 shadow-xl shadow-green-950/5', className)}>
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-gradient-to-r from-slate-50 to-green-50/70">
          <tr>
            {['Product', 'SKU', 'Category', 'Price', 'Stock', 'Status'].map((h, i) => <th key={h} className={cn('px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500', i >= 3 ? 'text-right' : 'text-left', i === 5 && 'text-center')}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((p) => (
            <tr key={p.id} className="cursor-pointer transition hover:bg-green-50/60" onClick={() => onSelect?.(p)}>
              <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-green-50">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-10 w-10 object-cover" /> : '🌿'}</div><span className="font-black text-slate-900">{p.name}</span></div></td>
              <td className="px-4 py-3 text-slate-500">{p.sku}</td><td className="px-4 py-3 text-slate-500">{p.category}</td><td className="px-4 py-3 text-right font-semibold text-slate-900">{formatLKR(p.price)}</td><td className="px-4 py-3 text-right">{p.stock || 0}</td><td className="px-4 py-3 text-center"><StockBand stock={p.stock} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderTable({ orders = [], onView, className }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-white/70 bg-white/80 shadow-xl shadow-green-950/5', className)}>
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-gradient-to-r from-slate-50 to-green-50/70"><tr>{['Order #', 'Date', 'Buyer', 'Total', 'Status'].map((h, i) => <th key={h} className={cn('px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500', i === 3 ? 'text-right' : i === 4 ? 'text-center' : 'text-left')}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((o) => <tr key={o.id} className="cursor-pointer transition hover:bg-green-50/60" onClick={() => onView?.(o)}><td className="px-4 py-3 font-black text-slate-900">{o.orderNo || o.id}</td><td className="px-4 py-3 text-slate-500">{o.date || o.createdAt}</td><td className="px-4 py-3 text-slate-500">{o.buyerName || o.buyerId}</td><td className="px-4 py-3 text-right font-semibold">{formatLKR(o.total)}</td><td className="px-4 py-3 text-center"><StatusBadge status={o.status} /></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function InvoiceCard({ invoice, onView, onPay, className }) {
  return (
    <div className={cn('rounded-2xl border border-white/70 bg-white/82 p-4 shadow-lg shadow-green-950/5', className)}>
      <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-sm font-black text-slate-950">Invoice {invoice.invoiceNo || invoice.id}</h4><StatusBadge status={invoice.status} /></div>
      <div className="space-y-1 text-sm"><p className="text-slate-500">Due: {invoice.dueDate}</p><p className="text-lg font-black">{formatLKR(invoice.total)}</p>{invoice.balance > 0 && <p className="font-semibold text-green-700">Balance: {formatLKR(invoice.balance)}</p>}</div>
      <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => onView?.(invoice)}>View</Button>{invoice.status === 'UNPAID' && <Button size="sm" onClick={() => onPay?.(invoice)}>Pay</Button>}</div>
    </div>
  );
}

export function RFQLineBuilder({ lines = [], onChange, products = [], className }) {
  const addLine = () => onChange([...lines, { productId: '', quantity: 1, targetPrice: '', note: '' }]);
  const updateLine = (idx, field, value) => { const next = [...lines]; next[idx] = { ...next[idx], [field]: value }; onChange(next); };
  const removeLine = (idx) => onChange(lines.filter((_, i) => i !== idx));

  return (
    <div className={cn('space-y-4', className)}>
      {lines.map((line, idx) => (
        <div key={idx} className="grid gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-100 md:grid-cols-[1fr_6rem_8rem_10rem_auto] md:items-end">
          <div><label className="mb-1 block text-xs font-semibold text-slate-500">Product</label><select value={line.productId} onChange={(e) => updateLine(idx, 'productId', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Select product...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-500">Qty</label><input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-500">Target Price</label><input type="number" step="0.01" value={line.targetPrice} onChange={(e) => updateLine(idx, 'targetPrice', e.target.value)} placeholder="Optional" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-500">Note</label><input type="text" value={line.note} onChange={(e) => updateLine(idx, 'note', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
          <button type="button" onClick={() => removeLine(idx)} className="rounded-xl p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600">✕</button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addLine}>+ Add Line</Button>
    </div>
  );
}
