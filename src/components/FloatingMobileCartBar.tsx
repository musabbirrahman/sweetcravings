'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';

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
        className="bg-[#2C1E19]/95 text-white backdrop-blur-md rounded-2xl p-3 px-4 shadow-elevated border border-brand-gold-light/25 flex items-center justify-between cursor-pointer active:scale-98 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-brand-caramel flex items-center justify-center shrink-0 shadow-soft">
            <ShoppingBag className="w-5 h-5 text-white" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-gold-light text-brand-chocolate font-extrabold text-[10px] flex items-center justify-center shadow-xs">
              {totalItemsCount}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-extrabold text-base text-brand-gold-light">
                ৳{subtotal}
              </span>
              <span className="text-white/40 text-xs">•</span>
              <span className="text-xs text-white/80 font-medium">
                {totalItemsCount} {lang === 'bn' ? 'টি মিষ্টি' : 'items'}
              </span>
            </div>
            <p className="text-[10px] text-brand-cream/80 leading-none mt-0.5 truncate max-w-[170px]">
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
          className="bg-brand-caramel hover:bg-brand-caramel-hover text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-soft flex items-center gap-1.5 shrink-0"
        >
          <span>{lang === 'bn' ? 'ব্যাগ দেখুন' : 'View Bag'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
