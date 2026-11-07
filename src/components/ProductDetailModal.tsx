'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product, ProductVariant } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import { X, Clock, AlertCircle, ShoppingBag, Plus, Minus, Check, Sparkles, ShieldCheck } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  const { lang, t } = useLanguage();
  const { addItem } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product?.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  if (!product) return null;

  const currentPrice = product.base_price + (selectedVariant ? selectedVariant.price_adjustment : 0);
  const isAvailable = product.status === 'published';

  const handleAddToCart = () => {
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
    setTimeout(() => {
      setIsAdded(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-[#201612]/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl z-10 animate-fade-in-up my-auto border border-brand-cream-dark/80">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 bg-white/95 hover:bg-white text-brand-chocolate p-2 rounded-full shadow-soft backdrop-blur-md transition-all btn-press"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[85vh] overflow-y-auto">
          
          {/* Product Image Column */}
          <div className="md:col-span-5 relative h-60 md:h-auto min-h-[240px] bg-brand-cream-subtle overflow-hidden">
            <Image
              src={product.image_url || '/sweet-cravings-logo.jpg'}
              alt={product.name_en}
              fill
              sizes="(max-width: 768px) 100vw, 380px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />
            
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 md:top-3 md:left-3 md:bottom-auto">
              <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {lang === 'bn' ? product.category_name_bn : product.category_name_en}
              </span>
            </div>
          </div>

          {/* Details & Customizer Column */}
          <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-brand-caramel font-semibold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? product.lead_time_bn : product.lead_time_en}</span>
                </div>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold text-brand-chocolate leading-tight">
                  {lang === 'bn' ? product.name_bn : product.name_en}
                </h3>
                <p className="text-xs sm:text-sm text-brand-taupe mt-2 leading-relaxed">
                  {lang === 'bn' ? product.description_bn : product.description_en}
                </p>
              </div>

              {/* Variants Selection (if any) */}
              {product.variants && product.variants.length > 0 && (
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
              {product.remaining_today !== undefined && (
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

            {/* Modal Bottom Controls */}
            <div className="pt-4 border-t border-brand-cream-dark flex items-center justify-between gap-3">
              {/* Stepper */}
              <div className="flex items-center border border-brand-cream-dark bg-brand-cream-subtle/50 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 hover:bg-white text-brand-chocolate transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-3 text-sm font-bold text-brand-chocolate min-w-[28px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 hover:bg-white text-brand-chocolate transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Bag CTA */}
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-semibold text-sm shadow-soft hover:shadow-card transition-all btn-press ${
                  isAdded
                    ? 'bg-brand-forest text-white'
                    : !isAvailable
                    ? 'bg-brand-cream-subtle text-brand-taupe/40 cursor-not-allowed'
                    : 'bg-brand-caramel hover:bg-brand-caramel-hover text-white'
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Bag!</span>
                  </>
                ) : !isAvailable ? (
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
