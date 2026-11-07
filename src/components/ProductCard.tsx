'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { Clock, Plus, Check } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { lang, t } = useLanguage();
  const { items, addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const isAvailable = product.status === 'published';
  const hasVariants = product.variants && product.variants.length > 0;

  // Check if item is already in cart
  const cartItem = items.find((i) => i.productId === product.id);

  const handleQuickAdd = () => {
    if (hasVariants) return; // variant products open their page instead
    addItem({
      productId: product.id,
      productSlug: product.slug,
      name_en: product.name_en,
      name_bn: product.name_bn,
      imageUrl: product.image_url || '/sweet-cravings-logo.jpg',
      unitPrice: product.base_price,
      quantity: 1,
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <article className="group bg-white rounded-3xl overflow-hidden border border-brand-chocolate/10 hover:border-brand-caramel/35 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col transform hover:-translate-y-1">
      {/* The card itself is a real link: keyboard-accessible, openable in
          a new tab, and announced as a link to screen readers. The price
          and add-to-bag row below sits outside the link so its button
          is not nested inside an anchor. */}
      <Link href={`/menu/${product.slug}`} className="flex flex-col flex-1">
        {/* Dessert Photo Frame */}
        <div className="relative aspect-[4/3] w-full bg-brand-cream overflow-hidden">
          <Image
            src={product.image_url || '/sweet-cravings-logo.jpg'}
            alt={product.name_en}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

          {/* Lead time badge: solid, readable, no frosted glass */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-brand-chocolate/70 text-brand-cream text-[10px] sm:text-[11px] font-medium px-3 py-1 rounded-full shadow-xs">
            <Clock className="w-3 h-3 text-brand-cream" />
            <span>{lang === 'bn' ? product.lead_time_bn : product.lead_time_en}</span>
          </div>

          {/* Sold out pill — the only status badge on the photo */}
          {!isAvailable && (
            <div className="absolute top-3 right-3">
              <span className="bg-brand-chocolate text-brand-cream text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                {t('menu.soldOut')}
              </span>
            </div>
          )}

          {/* Sold out overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-brand-chocolate/60 flex items-center justify-center">
              <span className="bg-brand-chocolate text-white font-bold text-xs uppercase px-3.5 py-1.5 rounded-full shadow-md tracking-wider">
                {t('menu.soldOut')}
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-caramel">
                {lang === 'bn' ? product.category_name_bn : product.category_name_en}
              </span>
              {cartItem && (
                <span className="text-[10px] font-bold bg-brand-caramel/10 text-brand-caramel px-2 py-0.5 rounded-full">
                  {lang === 'bn' ? `ব্যাগে ${cartItem.quantity}টি` : `${cartItem.quantity} in Bag`}
                </span>
              )}
            </div>

            <h3 className="font-heading font-semibold text-base sm:text-lg text-brand-chocolate group-hover:text-brand-caramel transition-colors line-clamp-1">
              {lang === 'bn' ? product.name_bn : product.name_en}
            </h3>

            <p className="text-xs text-brand-taupe line-clamp-2 leading-relaxed">
              {lang === 'bn' ? product.description_bn : product.description_en}
            </p>
          </div>
        </div>
      </Link>

      {/* Price & Action Row — outside the link, so the button stays a button */}
      <div className="px-5 pb-5 pt-3 border-t border-brand-chocolate/10 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-brand-taupe block leading-none font-medium">
            {hasVariants ? (lang === 'bn' ? 'শুরু মাত্র' : 'Starting from') : t('menu.price')}
          </span>
          <span className="font-heading text-xl font-bold text-brand-chocolate tracking-tight mt-0.5 block">
            ৳{product.base_price}
          </span>
        </div>

        {hasVariants ? (
          <Link
            href={`/menu/${product.slug}`}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xs btn-press ${
              !isAvailable
                ? 'bg-brand-cream text-brand-taupe/40 cursor-not-allowed'
                : 'bg-brand-cream hover:bg-brand-caramel hover:text-white text-brand-chocolate border border-brand-chocolate/10'
            }`}
          >
            <span>{t('menu.customise')}</span>
          </Link>
        ) : (
          <button
            onClick={handleQuickAdd}
            disabled={!isAvailable}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xs btn-press ${
              justAdded
                ? 'bg-brand-forest text-white'
                : !isAvailable
                ? 'bg-brand-cream text-brand-taupe/40 cursor-not-allowed'
                : 'bg-brand-caramel hover:bg-brand-chocolate text-white shadow-soft'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'যোগ হয়েছে!' : 'Added!'}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>{t('menu.addToCart')}</span>
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
