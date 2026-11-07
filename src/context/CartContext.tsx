'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from '@/lib/types';
import { useCatalog } from '@/context/CatalogContext';

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineTotal'>) => void;
  removeItem: (productId: number, variantId?: number) => void;
  updateQuantity: (productId: number, quantity: number, variantId?: number) => void;
  clearCart: () => void;
  totalItemsCount: number;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  freeDeliveryThreshold: number;
  remainingForFreeDelivery: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryFeeSetting, setDeliveryFeeSetting] = useState(50);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(1200);
  // Delivery fee settings come from the shared catalogue (fetched once
  // per page load) instead of a second /api/products call.
  const { settings } = useCatalog();

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sc_cart');
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply live delivery fee settings when the catalogue loads
  useEffect(() => {
    if (!settings) return;
    if (typeof settings.delivery_fee === 'number') {
      setDeliveryFeeSetting(settings.delivery_fee);
    }
    if (typeof settings.free_delivery_threshold === 'number') {
      setFreeDeliveryThreshold(settings.free_delivery_threshold);
    }
  }, [settings]);

  // Save to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem('sc_cart', JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'lineTotal'>) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.productId === newItem.productId && i.variantId === newItem.variantId
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const newQty = current.quantity + newItem.quantity;
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          lineTotal: current.unitPrice * newQty,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            ...newItem,
            lineTotal: newItem.unitPrice * newItem.quantity,
          },
        ];
      }
    });
    setIsCartOpen(true);
  };

  const removeItem = (productId: number, variantId?: number) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.productId === productId && (variantId === undefined || i.variantId === variantId))
      )
    );
  };

  const updateQuantity = (productId: number, quantity: number, variantId?: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId && item.variantId === variantId) {
          return {
            ...item,
            quantity,
            lineTotal: item.unitPrice * quantity,
          };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  // Delivery fee calculation
  const deliveryFee = subtotal === 0 ? 0 : (subtotal >= freeDeliveryThreshold ? 0 : deliveryFeeSetting);
  const totalAmount = subtotal + deliveryFee;
  const remainingForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItemsCount,
        subtotal,
        deliveryFee,
        totalAmount,
        freeDeliveryThreshold,
        remainingForFreeDelivery,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
