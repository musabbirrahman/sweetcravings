'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';

export default function CartDrawer() {
  const pathname = usePathname();
  const { 
    items, 
    removeItem, 
    updateQuantity, 
    isCartOpen, 
    setIsCartOpen, 
    subtotal, 
    deliveryFee, 
    totalAmount,
    freeDeliveryThreshold,
    remainingForFreeDelivery
  } = useCart();
  const { lang, t } = useLanguage();

  if (!isCartOpen || pathname?.startsWith('/admin')) return null;

  // Free delivery progress calculation
  const progressPercent = Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#201612]/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-brand-cream-dark/80 flex items-center justify-between bg-[#FAF7F2]">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-brand-caramel" />
              <h2 className="font-heading text-lg font-semibold text-brand-chocolate">
                {t('cart.title')}
              </h2>
              <span className="bg-brand-caramel-subtle text-brand-caramel text-xs px-2.5 py-0.5 rounded-full font-bold">
                {items.length}
              </span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-brand-taupe hover:text-brand-chocolate hover:bg-white rounded-full transition-all btn-press"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dynamic Free Delivery Progress Bar */}
          {subtotal > 0 && (
            <div className="bg-[#F7EFE8]/70 px-5 py-3 border-b border-brand-cream-dark/70 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-brand-chocolate">
                  <Sparkles className="w-4 h-4 text-brand-caramel shrink-0" />
                  {remainingForFreeDelivery > 0 ? (
                    lang === 'bn' 
                      ? `আর মাত্র ৳${remainingForFreeDelivery} টাকার আইটেম যোগ করলে ফ্রি ডেলিভারি!` 
                      : `Add ৳${remainingForFreeDelivery} more for FREE Rajshahi delivery!`
                  ) : (
                    <span className="text-brand-forest font-semibold">
                      {lang === 'bn' ? '🎉 ফ্রি ডেলিভারি আনলক হয়েছে!' : '🎉 Free Delivery Unlocked!'}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11px] font-semibold text-brand-taupe">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-brand-cream-dark/80 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    remainingForFreeDelivery === 0 ? 'bg-brand-forest' : 'bg-brand-caramel'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            {items.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-20 h-20 mx-auto bg-brand-cream-subtle rounded-3xl flex items-center justify-center text-brand-caramel border border-brand-cream-dark">
                  <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-brand-chocolate">
                    {t('cart.empty')}
                  </h3>
                  <p className="text-xs text-brand-taupe mt-1 max-w-xs mx-auto leading-relaxed">
                    {t('cart.emptyDesc')}
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="inline-block bg-brand-chocolate text-brand-gold-light text-xs font-bold px-6 py-3 rounded-full hover:bg-brand-chocolate-light transition-all btn-press shadow-soft"
                >
                  {t('cart.explore')}
                </button>
              </div>
            ) : (
              items.map((item, idx) => (
                <div 
                  key={`${item.productId}-${item.variantId || 'base'}-${idx}`}
                  className="flex gap-3.5 bg-brand-cream-subtle/30 border border-brand-cream-dark rounded-2xl p-3.5 shadow-sm hover:border-brand-caramel/30 transition-colors"
                >
                  {/* Item Image */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-brand-cream-subtle border border-brand-cream-dark/60">
                    <Image 
                      src={item.imageUrl || '/sweet-cravings-logo.jpg'} 
                      alt={item.name_en} 
                      fill 
                      className="object-cover" 
                    />
                  </div>

                  {/* Info & Controls */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-heading font-bold text-sm text-brand-chocolate truncate">
                        {lang === 'bn' ? item.name_bn : item.name_en}
                      </h4>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="text-brand-taupe/50 hover:text-brand-strawberry transition-colors p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {(item.variantLabel_en || item.variantLabel_bn) && (
                      <p className="text-[11px] text-brand-caramel font-semibold mt-0.5">
                        {lang === 'bn' ? item.variantLabel_bn : item.variantLabel_en}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2.5">
                      <span className="font-heading font-bold text-sm text-brand-chocolate">
                        ৳{item.lineTotal}
                      </span>

                      {/* Stepper */}
                      <div className="flex items-center border border-brand-cream-dark bg-white rounded-xl overflow-hidden shadow-sm">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                          className="px-2.5 py-1 hover:bg-brand-cream-subtle text-brand-chocolate transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-brand-chocolate min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                          className="px-2.5 py-1 hover:bg-brand-cream-subtle text-brand-chocolate transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer (Subtotal & Checkout CTA) */}
          {items.length > 0 && (
            <div className="p-5 border-t border-brand-cream-dark bg-brand-cream-subtle/50 space-y-3.5">
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-brand-taupe">
                  <span>{t('cart.subtotal')}</span>
                  <span className="font-semibold text-brand-chocolate">৳{subtotal}</span>
                </div>
                <div className="flex justify-between text-brand-taupe">
                  <span>{t('cart.deliveryFee')}</span>
                  <span className="font-semibold">
                    {deliveryFee === 0 ? (
                      <span className="text-brand-forest font-bold">
                        {lang === 'bn' ? 'ফ্রি' : 'FREE'}
                      </span>
                    ) : (
                      `৳${deliveryFee}`
                    )}
                  </span>
                </div>
                <div className="border-t border-brand-cream-dark pt-2.5 flex justify-between font-heading text-base font-bold text-brand-chocolate">
                  <span>{t('cart.total')}</span>
                  <span className="text-brand-caramel font-extrabold text-xl">৳{totalAmount}</span>
                </div>
              </div>

              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full flex items-center justify-center gap-2 bg-brand-caramel hover:bg-brand-caramel-dark text-white py-4 px-6 rounded-2xl font-bold text-sm shadow-card hover:shadow-card-hover transition-all btn-press"
              >
                <span>{t('cart.checkout')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
