'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { useAuth } from './auth';

const CartContext = createContext(null);

const CART_KEY = 'pg_cart_v1';

function loadMirror() {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : { items: [] };
  } catch {
    return { items: [] };
  }
}

function saveMirror(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // Ignore
  }
}

export function CartProvider({ children }) {
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState(() => loadMirror().items || []);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef(null);
  const initialLoadDone = useRef(false);

  // Reconcile with the server cart — only for signed-in users. Guests browse
  // public pages with a local-only mirror, so we never hit the authed /cart
  // endpoint (which would 401 and bounce them to /login).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      initialLoadDone.current = true;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/cart');
        if (!cancelled) {
          setItems(res.data.items || []);
          saveMirror(res.data);
        }
      } catch {
        // Use mirror if server unavailable
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          initialLoadDone.current = true;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Debounced server sync — only when signed in.
  const syncToServer = useCallback((cartItems) => {
    if (!initialLoadDone.current || !user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await api.put('/cart', { items: cartItems });
      } catch {
        // Silently fail - mirror is source of truth
      }
    }, 1500);
  }, [user]);

  const updateItems = useCallback((newItems) => {
    setItems(newItems);
    const mirror = { items: newItems };
    saveMirror(mirror);
    syncToServer(newItems);
  }, [syncToServer]);

  const addItem = useCallback((item) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      let next;
      if (existing) {
        next = prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      } else {
        next = [...prev, { ...item, quantity: item.quantity || 1 }];
      }
      saveMirror({ items: next });
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  const removeItem = useCallback((productId) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId);
      saveMirror({ items: next });
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  const updateQuantity = useCallback((productId, quantity) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i
      );
      saveMirror({ items: next });
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  const clearCart = useCallback(() => {
    setItems([]);
    saveMirror({ items: [] });
    syncToServer([]);
  }, [syncToServer]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
