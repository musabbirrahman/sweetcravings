'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product, ProductVariant } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { X, Clock, AlertCircle, ShoppingBag, Plus, Minus, Check, Sparkles, ArrowLeft } from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
}

/**
 * Full product detail view, shared by the /menu/:slug page.
 * Same content as the old detail pop-up, on its own shareable page:
 * photo, bilingual name and description, price and size options,
 * lead time, ingredients and allergens, today's batch, add to bag.
 */
export default function ProductDetailView({ product }: ProductDetailViewProps) {
  const { lang, t } = useLanguage();
  const { addItem } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product?.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  const currentPrice = product.base_price + (selectedVariant ? selectedVariant.price_adjustment : 0);
  const isAvailable = product.status === 'published';
  const batchSoldOut = isAvailable && (product.remaining_today ?? 1) <= 0;

  const handleAddToCart = () => {
    if (!isAvailable || batchSoldOut) return;
    addItem({
      productId: product.id,
      productSlug: product.slug,
      name_en: product.name_en,
      name_bn: product.name_bn,
      imageUrl: product.image_url || '/sweet-cravings-logo.jpg',
      variantId: selectedVariant?.id,
      variantLabel_en: selectedVariant?.label_en,
      variantLabel_bn: selectedVariant?.label_bn,
      unitPrice: currentPrice,
      quantity,
    });

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 font-sans">
      {/* Back to menu */}
      <Link
        href="/menu"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-taupe hover:text-brand-chocolate transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{t('menu.backToMenu')}</span>
      </Link>

      <div className="bg-white rounded-3xl overflow-hidden border border-brand-cream-dark/80 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Product Image */}
          <div className="relative h-72 sm:h-96 md:h-auto md:min-h-[480px] bg-brand-cream-subtle overflow-hidden">
            <Image
              src={product.image_url || '/sweet-cravings-logo.jpg'}
              alt={product.name_en}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            {!isAvailable && (
              <div className="absolute inset-0 bg-[#201612]/60 backdrop-blur-[2px] flex items-center justify-center">
                <span className="bg-brand-strawberry text-white font-bold text-xs uppercase px-3.5 py-1.5 rounded-full shadow-md tracking-wider">
                  {t('menu.soldOut')}
                </span>
              </div>
            )}
            <div className="absolute top-3 left-3">
              <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {lang === 'bn' ? product.category_name_bn : product.category_name_en}
              </span>
            </div>
          </div>

          {/* Details Column */}
          <div className="p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-brand-caramel font-semibold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? product.lead_time_bn : product.lead_time_en}</span>
                </div>
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-brand-chocolate leading-tight">
                  {lang === 'bn' ? product.name_bn : product.name_en}
                </h1>
                <p className="text-sm text-brand-taupe mt-2 leading-relaxed">
                  {lang === 'bn' ? product.description_bn : product.description_en}
                </p>
                <p className="font-heading text-2xl font-bold text-brand-chocolate mt-3">
                  ৳{product.base_price}
                  {product.variants && product.variants.length > 0 && (
                    <span className="text-xs font-normal text-brand-taupe ml-2">
                      {lang === 'bn' ? 'থেকে শুরু' : 'starting from'}
                    </span>
                  )}
                </p>
              </div>

              {/* Unavailable notice */}
              {!isAvailable && (
                <div className="flex items-start gap-2 text-brand-taupe bg-brand-vanilla/90 p-3 rounded-2xl border border-brand-cream-dark text-xs">
                  <X className="w-4 h-4 shrink-0 mt-0.5 text-brand-strawberry" />
                  <span>
                    <strong className="text-brand-chocolate">{t('menu.unavailable')}.</strong>{' '}
                    {lang === 'bn'
                      ? 'এই ডেজার্টটি এখন অর্ডারের জন্য নেই — মেনুতে অন্য কিছু দেখুন।'
                      : 'This dessert is not available for ordering right now — please pick another from the menu.'}
                  </span>
                </div>
              )}

              {/* Variants Selection (if any) */}
              {isAvailable && product.variants && product.variants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-brand-cream-dark">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-brand-taupe block">
                    {t('menu.options')}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {product.variants.map((v) => {
                      const isSelected = selectedVariant?.id === v.id;
                      const priceDelta = v.price_adjustment;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariant(v)}
                          className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-xs sm:text-sm font-medium transition-all ${
                            isSelected
                              ? 'border-brand-caramel bg-brand-caramel-subtle/50 text-brand-chocolate font-bold shadow-sm'
                              : 'border-brand-cream-dark hover:border-brand-caramel/40 text-brand-taupe hover:text-brand-chocolate'
                          }`}
                        >
                          <span>{lang === 'bn' ? v.label_bn : v.label_en}</span>
                          <span className="text-brand-caramel font-bold font-heading">
                            {priceDelta === 0 ? `৳${product.base_price}` : `৳${product.base_price + priceDelta}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Daily Kitchen Batch Indicator */}
              {isAvailable && product.remaining_today !== undefined && (
                <div className="bg-brand-cream-subtle rounded-2xl p-3 border border-brand-cream-dark text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-brand-chocolate font-medium">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-brand-caramel" />
                      <span>{lang === 'bn' ? 'আজকের ফ্রেশ মর্নিং ব্যাচ' : "Today's Fresh Morning Batch"}</span>
                    </span>
                    <span className="font-bold text-brand-caramel">
                      {lang === 'bn'
                        ? `${product.remaining_today} / ${product.daily_batch_limit || 15}টি বাকি`
                        : `${product.remaining_today} of ${product.daily_batch_limit || 15} left`}
                    </span>
                  </div>
                  <div className="w-full bg-brand-cream-dark/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-brand-caramel to-brand-gold-light h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, (product.remaining_today / (product.daily_batch_limit || 15)) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Ingredients & Allergens Information */}
              <div className="space-y-2.5 pt-2 border-t border-brand-cream-dark text-xs">
                {(product.ingredients_en || product.ingredients_bn) && (
                  <p className="text-brand-taupe leading-relaxed">
                    <strong className="text-brand-chocolate">{t('menu.ingredients')}:</strong>{' '}
                    {lang === 'bn' ? product.ingredients_bn : product.ingredients_en}
                  </p>
                )}

                {(product.allergens_en || product.allergens_bn) && (
                  <div className="flex items-start gap-2 text-brand-taupe bg-brand-vanilla/90 p-3 rounded-2xl border border-brand-cream-dark">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-brand-caramel" />
                    <span>
                      <strong className="text-brand-chocolate">{t('menu.allergens')}:</strong>{' '}
                      {lang === 'bn' ? product.allergens_bn : product.allergens_en}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="pt-4 border-t border-brand-cream-dark flex items-center justify-between gap-3">
              {/* Stepper */}
              <div className="flex items-center border border-brand-cream-dark bg-brand-cream-subtle/50 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={!isAvailable || batchSoldOut}
                  className="p-3 hover:bg-white text-brand-chocolate transition-colors disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 text-sm font-bold text-brand-chocolate min-w-[28px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={!isAvailable || batchSoldOut}
                  className="p-3 hover:bg-white text-brand-chocolate transition-colors disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Bag CTA */}
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable || batchSoldOut}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-semibold text-sm shadow-soft hover:shadow-card transition-all btn-press ${
                  isAdded
                    ? 'bg-brand-forest text-white'
                    : !isAvailable || batchSoldOut
                    ? 'bg-brand-cream-subtle text-brand-taupe/40 cursor-not-allowed'
                    : 'bg-brand-caramel hover:bg-brand-caramel-hover text-white'
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Bag!</span>
                  </>
                ) : !isAvailable || batchSoldOut ? (
                  <span>{t('menu.soldOut')}</span>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {t('menu.addToCart')} • ৳{currentPrice * quantity}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
