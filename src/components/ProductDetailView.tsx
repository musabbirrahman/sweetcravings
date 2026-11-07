'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product, ProductVariant } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import { X, Clock, AlertCircle, ShoppingBag, Plus, Minus, Check, ArrowLeft, Truck, Banknote } from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  related?: Product[];
}

// Detail photos are upscaled beyond their source at w=800; ask Unsplash
// for a 1200px-wide source so the large detail image stays sharp.
function detailImageUrl(url: string | null | undefined): string {
  const fallback = '/sweet-cravings-logo.jpg';
  if (!url) return fallback;
  if (url.includes('images.unsplash.com')) {
    return url.replace(/([?&])w=\d+/, '$1w=1200');
  }
  return url;
}

/**
 * Full product detail view, shared by the /menu/:slug page.
 * Same content as the old detail pop-up, on its own shareable page:
 * photo, bilingual name and description, price and size options,
 * lead time, ingredients and allergens, today's batch, add to bag,
 * a delivery & payment strip, and related products.
 */
export default function ProductDetailView({ product, related = [] }: ProductDetailViewProps) {
  const { lang, t } = useLanguage();
  const { addItem } = useCart();
  const { settings } = useCatalog();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product?.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  const currentPrice = product.base_price + (selectedVariant ? selectedVariant.price_adjustment : 0);
  const isAvailable = product.status === 'published';
  const batchSoldOut = isAvailable && (product.remaining_today ?? 1) <= 0;

  // Batch numbers: sold is what actually happened today, remaining is
  // what is left. The bar is only shown when stock is low (5 or fewer
  // left) so it never reads as manufactured urgency when plenty remains.
  const batchLimit = product.daily_batch_limit || 15;
  const remaining = product.remaining_today ?? batchLimit;
  const soldToday = Math.max(0, batchLimit - remaining);
  const showBatchBar = isAvailable && product.remaining_today !== undefined && remaining <= 5;

  // Delivery & payment strip: live settings with sensible fallbacks
  // while the catalogue is still loading.
  const deliveryFee = settings?.delivery_fee ?? 50;
  const paymentMethods: string[] = [];
  if (!settings || settings.cod_enabled !== false) {
    paymentMethods.push(lang === 'bn' ? 'ক্যাশ অন ডেলিভারি' : 'Cash on Delivery');
  }
  if (!settings || (settings.bkash_enabled !== false && settings.bkash_number)) {
    paymentMethods.push('bKash');
  }
  if (!settings || (settings.nagad_enabled !== false && settings.nagad_number)) {
    paymentMethods.push('Nagad');
  }

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

      <div className="bg-white rounded-3xl overflow-hidden border border-brand-chocolate/10 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Product Image */}
          <div className="relative h-72 sm:h-96 md:h-auto md:min-h-[480px] bg-brand-cream overflow-hidden">
            <Image
              src={detailImageUrl(product.image_url)}
              alt={product.name_en}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            {!isAvailable && (
              <div className="absolute inset-0 bg-brand-chocolate/60 flex items-center justify-center">
                <span className="bg-brand-chocolate text-white font-bold text-xs uppercase px-3.5 py-1.5 rounded-full shadow-md tracking-wider">
                  {t('menu.soldOut')}
                </span>
              </div>
            )}
            <div className="absolute top-3 left-3">
              <span className="bg-brand-chocolate/70 text-brand-cream text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
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
                  ৳{currentPrice}
                </p>
              </div>

              {/* Unavailable notice */}
              {!isAvailable && (
                <div className="flex items-start gap-2 text-brand-taupe bg-brand-cream/90 p-3 rounded-2xl border border-brand-chocolate/10 text-xs">
                  <X className="w-4 h-4 shrink-0 mt-0.5 text-brand-chocolate" />
                  <span>
                    <strong className="text-brand-chocolate">{t('menu.unavailable')}.</strong>{' '}
                    {lang === 'bn'
                      ? 'এই ডেজার্টটি এখন অর্ডারের জন্য নেই — মেনুতে অন্য কিছু দেখুন।'
                      : 'This dessert is not available for ordering right now — please pick another from the menu.'}
                  </span>
                </div>
              )}

              {/* Variants Selection (if any) — selectable cards */}
              {isAvailable && product.variants && product.variants.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-brand-chocolate/10">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-brand-taupe block">
                    {t('menu.options')}
                  </label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('menu.options')}>
                    {product.variants.map((v) => {
                      const isSelected = selectedVariant?.id === v.id;
                      const priceDelta = v.price_adjustment;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setSelectedVariant(v)}
                          className={`relative flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border text-xs sm:text-sm font-medium transition-all ${
                            isSelected
                              ? 'border-brand-caramel bg-brand-caramel/10 text-brand-chocolate font-bold shadow-sm ring-1 ring-brand-caramel'
                              : 'border-brand-chocolate/10 hover:border-brand-caramel/40 text-brand-taupe hover:text-brand-chocolate'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-caramel text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <span className="pr-5">{lang === 'bn' ? v.label_bn : v.label_en}</span>
                          <span className="text-brand-caramel font-bold font-heading">
                            {priceDelta === 0 ? `৳${product.base_price}` : `৳${product.base_price + priceDelta}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Today's batch — shown only when stock is low, and it
                  shows what sold, not a full bar when nothing sold. */}
              {showBatchBar && (
                <div className="bg-brand-cream rounded-2xl p-3 border border-brand-chocolate/10 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-brand-chocolate font-medium">
                    <span className="font-bold">
                      {lang === 'bn' ? 'আজকের ব্যাচ' : "Today's batch"}
                    </span>
                    <span className="font-bold text-brand-caramel">
                      {lang === 'bn'
                        ? `আজ ${soldToday}টি বিক্রি · ${remaining}টি বাকি`
                        : `${soldToday} sold · ${remaining} left today`}
                    </span>
                  </div>
                  <div className="w-full bg-brand-chocolate/5 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-caramel h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, (soldToday / batchLimit) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Ingredients & Allergens Information */}
              <div className="space-y-2.5 pt-2 border-t border-brand-chocolate/10 text-xs">
                {(product.ingredients_en || product.ingredients_bn) && (
                  <p className="text-brand-taupe leading-relaxed">
                    <strong className="text-brand-chocolate">{t('menu.ingredients')}:</strong>{' '}
                    {lang === 'bn' ? product.ingredients_bn : product.ingredients_en}
                  </p>
                )}

                {(product.allergens_en || product.allergens_bn) && (
                  <div className="flex items-start gap-2 text-brand-taupe bg-brand-cream/90 p-3 rounded-2xl border border-brand-chocolate/10">
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
            <div className="pt-4 border-t border-brand-chocolate/10 flex items-center justify-between gap-3">
              {/* Stepper */}
              <div className="flex items-center border border-brand-chocolate/10 bg-brand-cream/50 rounded-2xl overflow-hidden shadow-sm">
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
                    ? 'bg-brand-cream text-brand-taupe/40 cursor-not-allowed'
                    : 'bg-brand-caramel hover:bg-brand-chocolate text-white'
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'ব্যাগে যোগ হয়েছে!' : 'Added to Bag!'}</span>
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

            {/* Delivery & payment strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-4 text-xs text-brand-taupe border-t border-brand-chocolate/10">
              <span className="flex items-center gap-1.5 font-medium">
                <Truck className="w-4 h-4 text-brand-caramel shrink-0" />
                <span>
                  {lang === 'bn'
                    ? `ডেলিভারি ৳${deliveryFee} · রাজশাহী শহরজুড়ে`
                    : `Delivery ৳${deliveryFee} · across Rajshahi city`}
                </span>
              </span>
              {paymentMethods.length > 0 && (
                <span className="flex items-center gap-1.5 font-medium">
                  <Banknote className="w-4 h-4 text-brand-caramel shrink-0" />
                  <span>{paymentMethods.join(' · ')}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-brand-caramel shrink-0" />
                <span>{lang === 'bn' ? product.lead_time_bn : product.lead_time_en}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="pt-4">
          <h2 className="font-heading text-xl sm:text-2xl font-semibold text-brand-chocolate mb-4">
            {lang === 'bn' ? 'আপনার পছন্দ হতে পারে' : 'You may also like'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
