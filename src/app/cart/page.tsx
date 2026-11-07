'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { ShoppingBag, ArrowRight, Trash2, Plus, Minus, Sparkles, MapPin } from 'lucide-react';

export default function CartPage() {
  const { 
    items, 
    removeItem, 
    updateQuantity, 
    clearCart,
    subtotal, 
    deliveryFee, 
    totalAmount,
    remainingForFreeDelivery 
  } = useCart();
  const { lang, t } = useLanguage();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-24 h-24 mx-auto rounded-full bg-brand-cream-subtle flex items-center justify-center text-brand-caramel border border-brand-cream-dark">
          <ShoppingBag className="w-12 h-12 stroke-[1.5]" />
        </div>
        <h1 className="font-heading text-3xl font-semibold text-brand-chocolate">
          {t('cart.empty')}
        </h1>
        <p className="text-sm text-brand-taupe max-w-sm mx-auto leading-relaxed">
          {t('cart.emptyDesc')}
        </p>
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 bg-brand-caramel hover:bg-brand-caramel-hover text-white font-semibold py-3.5 px-8 rounded-full shadow-soft transition-all btn-press"
        >
          <span>{t('cart.explore')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-brand-cream-dark/70 pb-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-brand-chocolate">
            {t('cart.title')}
          </h1>
          <p className="text-xs text-brand-taupe mt-0.5">
            {items.length} {t('cart.items')}
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-brand-taupe hover:text-brand-strawberry transition-colors"
        >
          {t('cart.clearCart')}
        </button>
      </div>

      {/* Free delivery notice */}
      <div className="bg-brand-vanilla border border-brand-cream-dark p-3.5 rounded-2xl flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-brand-chocolate">
          <Sparkles className="w-4 h-4 text-brand-caramel shrink-0" />
          <span>
            {remainingForFreeDelivery > 0
              ? lang === 'bn'
                ? `আর মাত্র ৳${remainingForFreeDelivery} টাকার আইটেম যোগ করলে ফ্রি ডেলিভারি!`
                : `Add ৳${remainingForFreeDelivery} more to enjoy Free Delivery across Rajshahi!`
              : lang === 'bn'
              ? '🎉 অভিনন্দন! আপনার অর্ডারে ফ্রি ডেলিভারি যুক্ত হয়েছে।'
              : '🎉 You have unlocked Free Delivery!'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs text-brand-taupe">
          <MapPin className="w-3.5 h-3.5 text-brand-forest" />
          <span>Rajshahi</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Items List */}
        <div className="md:col-span-7 space-y-3.5">
          {items.map((item, idx) => (
            <div
              key={`${item.productId}-${item.variantId || 'base'}-${idx}`}
              className="bg-white p-4 rounded-2xl border border-brand-cream-dark shadow-soft flex gap-4 items-center"
            >
              <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-brand-cream-subtle">
                <Image
                  src={item.imageUrl || '/sweet-cravings-logo.jpg'}
                  alt={item.name_en}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="font-heading font-bold text-base text-brand-chocolate truncate">
                    {lang === 'bn' ? item.name_bn : item.name_en}
                  </h3>
                  <button
                    onClick={() => removeItem(item.productId, item.variantId)}
                    className="text-brand-taupe/60 hover:text-brand-strawberry p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {(item.variantLabel_en || item.variantLabel_bn) && (
                  <p className="text-xs text-brand-caramel font-medium mt-0.5">
                    {lang === 'bn' ? item.variantLabel_bn : item.variantLabel_en}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-brand-cream-dark bg-brand-cream-subtle/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                      className="px-2.5 py-1 hover:bg-brand-cream text-brand-chocolate transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 text-xs font-bold text-brand-chocolate">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                      className="px-2.5 py-1 hover:bg-brand-cream text-brand-chocolate transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-heading font-bold text-base text-brand-chocolate">
                    ৳{item.lineTotal}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Card */}
        <div className="md:col-span-5">
          <div className="bg-white p-6 rounded-2xl border border-brand-cream-dark shadow-soft space-y-5 sticky top-28">
            <h2 className="font-heading font-bold text-lg text-brand-chocolate border-b border-brand-cream-dark pb-3">
              {t('checkout.orderSummary')}
            </h2>

            <div className="space-y-3 text-sm">
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
              <div className="border-t border-brand-cream-dark pt-3 flex justify-between font-heading text-lg font-bold text-brand-chocolate">
                <span>{t('cart.total')}</span>
                <span className="text-brand-caramel font-extrabold text-xl">৳{totalAmount}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="w-full flex items-center justify-center gap-2 bg-brand-caramel hover:bg-brand-caramel-dark text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-soft hover:shadow-soft-hover transition-all"
            >
              <span>{t('cart.checkout')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/menu"
              className="block text-center text-xs font-semibold text-brand-caramel hover:underline"
            >
              {lang === 'bn' ? '← আরও ডেজার্ট যোগ করুন' : '← Continue Shopping'}
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
