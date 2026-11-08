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

/**
 * Menu card (redesign 2026-11-08):
 * - 3:2 photo, object-cover centre, on a neutral #EFE9E2 bed — no gradient
 *   overlay, no pill on the photo. If the image fails to load the card
 *   shows a tidy neutral block with the product name, never a broken-image
 *   icon or alt text leaking over a pill.
 * - Lead time lives in the card body as quiet secondary text.
 * - ONE button style for every card: solid ink "Add to cart". Variant
 *   products use the same button — it opens the product page, where the
 *   variant selector lives.
 */
export default function ProductCard({ product }: ProductCardProps) {
  const { lang, t } = useLanguage();
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const isAvailable = product.status === 'published';
  const hasVariants = product.variants && product.variants.length > 0;
  const name = lang === 'bn' ? product.name_bn : product.name_en;

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

  const photo = imgFailed ? (
    <div className="flex h-full w-full items-center justify-center bg-[#EFE9E2] px-4 text-center text-[15px] font-semibold text-brand-taupe">
      {name}
    </div>
  ) : (
    <Image
      src={product.image_url || '/sweet-cravings-logo.jpg'}
      alt={product.name_en}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
      onError={() => setImgFailed(true)}
    />
  );

  return (
    <article className="group bg-white rounded-2xl overflow-hidden border border-[#E7DFD6] hover:border-brand-caramel/40 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col transform hover:-translate-y-1">
      {/* The card itself is a real link: keyboard-accessible, openable in
          a new tab, and announced as a link to screen readers. The price
          and add-to-bag row below sits outside the link so its button
          is not nested inside an anchor. */}
      <Link href={`/menu/${product.slug}`} className="flex flex-col flex-1">
        {/* Dessert Photo Frame — 3:2, neutral bed, nothing on top of it */}
        <div className="relative aspect-[3/2] w-full bg-[#EFE9E2] overflow-hidden">
          {photo}

          {/* Sold out pill — the only status badge on the photo */}
          {!isAvailable && (
            <div className="absolute top-3 right-3">
              <span className="bg-brand-chocolate text-brand-cream text-[13px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                {t('menu.soldOut')}
              </span>
            </div>
          )}

          {/* Sold out overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-brand-chocolate/60 flex items-center justify-center">
              <span className="bg-brand-chocolate text-white font-bold text-[13px] uppercase px-3.5 py-1.5 rounded-full shadow-md tracking-wider">
                {t('menu.soldOut')}
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold text-brand-caramel">
              {lang === 'bn' ? product.category_name_bn : product.category_name_en}
            </span>

            <h3 className="font-heading font-bold text-lg text-brand-chocolate group-hover:text-brand-caramel transition-colors line-clamp-1">
              {name}
            </h3>

            <p className="text-[13px] text-brand-taupe line-clamp-2 leading-relaxed">
              {lang === 'bn' ? product.description_bn : product.description_en}
            </p>

            <p className="flex items-center gap-1.5 text-[13px] text-brand-taupe pt-1">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'bn' ? product.lead_time_bn : product.lead_time_en}</span>
            </p>
          </div>
        </div>
      </Link>

      {/* Price & Action Row — outside the link, so the button stays a button */}
      <div className="px-5 pb-5 pt-3 border-t border-[#E7DFD6] flex items-center justify-between">
        <div>
          <span className="text-[13px] text-brand-taupe block leading-none font-medium">
            {hasVariants ? (lang === 'bn' ? 'শুরু মাত্র' : 'Starting from') : t('menu.price')}
          </span>
          <span className="font-heading text-xl font-bold text-brand-chocolate tracking-tight mt-0.5 block">
            ৳{product.base_price}
          </span>
        </div>

        {hasVariants ? (
          <Link
            href={`/menu/${product.slug}`}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all shadow-xs btn-press ${
              !isAvailable
                ? 'bg-[#EFE9E2] text-brand-taupe/40 cursor-not-allowed'
                : 'bg-brand-chocolate hover:bg-brand-chocolate text-white shadow-soft'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('menu.addToCart')}</span>
          </Link>
        ) : (
          <button
            onClick={handleQuickAdd}
            disabled={!isAvailable}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all shadow-xs btn-press ${
              justAdded
                ? 'bg-brand-forest text-white'
                : !isAvailable
                ? 'bg-[#EFE9E2] text-brand-taupe/40 cursor-not-allowed'
                : 'bg-brand-chocolate hover:bg-brand-chocolate text-white shadow-soft'
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
