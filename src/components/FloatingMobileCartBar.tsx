'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { ShoppingBag, ArrowRight } from 'lucide-react';

export default function FloatingMobileCartBar() {
  const pathname = usePathname();
  const { items, subtotal, setIsCartOpen, remainingForFreeDelivery } = useCart();
  const { lang } = useLanguage();

  // Hide on checkout, cart, tracking, and admin pages
  if (
    items.length === 0 ||
    pathname === '/checkout' ||
    pathname === '/cart' ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/order')
  ) {
    return null;
  }

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside 
      aria-label="Floating mobile cart checkout bar"
      className="fixed bottom-3 left-3 right-3 sm:hidden z-30 animate-fade-in"
    >
      <div 
        onClick={() => setIsCartOpen(true)}
        className="bg-brand-chocolate/95 text-white backdrop-blur-md rounded-2xl p-3 px-4 shadow-elevated border border-brand-cream/25 flex items-center justify-between cursor-pointer active:scale-98 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-brand-chocolate flex items-center justify-center shrink-0 shadow-soft">
            <ShoppingBag className="w-5 h-5 text-white" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-cream text-brand-chocolate font-extrabold text-[13px] flex items-center justify-center shadow-xs">
              {totalItemsCount}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-extrabold text-base text-brand-cream">
                ৳{subtotal}
              </span>
              <span className="text-white/40 text-[13px]">•</span>
              <span className="text-[13px] text-white/80 font-medium">
                {totalItemsCount} {lang === 'bn' ? 'টি মিষ্টি' : 'items'}
              </span>
            </div>
            <p className="text-[13px] text-brand-cream/80 leading-none mt-0.5 truncate max-w-[170px]">
              {remainingForFreeDelivery > 0
                ? (lang === 'bn' ? `আর ৳${remainingForFreeDelivery} তে ফ্রি ডেলিভারি` : `Add ৳${remainingForFreeDelivery} for FREE delivery`)
                : (lang === 'bn' ? '🎉 ফ্রি ডেলিভারি সক্রিয়!' : '🎉 Free Delivery Unlocked!')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsCartOpen(true);
          }}
          className="bg-brand-chocolate hover:bg-brand-chocolate text-white px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all shadow-soft flex items-center gap-1.5 shrink-0"
        >
          <span>{lang === 'bn' ? 'ব্যাগ দেখুন' : 'View Bag'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
