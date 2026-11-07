'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import ProductDetailModal from './ProductDetailModal';
import { Clock, Plus, Eye, Check, Sparkles, Flame } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { lang, t } = useLanguage();
  const { items, addItem } = useCart();
  const [modalOpen, setModalOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const isAvailable = product.status === 'published';
  const hasVariants = product.variants && product.variants.length > 0;

  // Check if item is already in cart
  const cartItem = items.find((i) => i.productId === product.id);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariants) {
      setModalOpen(true);
      return;
    }

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
    <>
      <div 
        onClick={() => setModalOpen(true)}
        className="group bg-white rounded-3xl overflow-hidden border border-brand-cream-dark/90 hover:border-brand-caramel/35 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col cursor-pointer transform hover:-translate-y-1"
      >
        {/* Dessert Photo Frame */}
        <div className="relative aspect-[4/3] w-full bg-brand-cream-subtle overflow-hidden">
          <Image
            src={product.image_url || '/sweet-cravings-logo.jpg'}
            alt={product.name_en}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-104 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

          {/* Lead time badge: Soft Frosted Glass */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#201612]/65 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 shadow-xs">
            <Clock className="w-3 h-3 text-brand-gold-light" />
            <span>{lang === 'bn' ? product.lead_time_bn : product.lead_time_en}</span>
          </div>

          {/* Daily Batch Scarcity Badge */}
          {product.remaining_today !== undefined && isAvailable && (
            <div className="absolute top-3 right-3">
              {product.remaining_today <= 4 && product.remaining_today > 0 ? (
                <div className="flex items-center gap-1 bg-[#2C1E19]/90 backdrop-blur-md text-[#E8A856] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#E8A856]/40 shadow-sm animate-pulse">
                  <Flame className="w-3 h-3 text-[#E8A856]" />
                  <span>
                    {lang === 'bn' ? `আর মাত্র ${product.remaining_today}টি বাকি` : `Only ${product.remaining_today} left`}
                  </span>
                </div>
              ) : product.remaining_today === 0 ? (
                <div className="flex items-center gap-1 bg-brand-strawberry/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                  <span>{lang === 'bn' ? 'আজকের ব্যাচ শেষ' : 'Batch Sold Out'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-[#201612]/60 backdrop-blur-md text-brand-gold-light text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/10 shadow-xs">
                  <Sparkles className="w-2.5 h-2.5 text-brand-gold-light" />
                  <span>{lang === 'bn' ? 'সকালে তাজা তৈরি' : 'Fresh Batch'}</span>
                </div>
              )}
            </div>
          )}

          {/* Sold out overlay */}
          {!isAvailable && (
            <div className="absolute inset-0 bg-[#201612]/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-brand-strawberry text-white font-bold text-xs uppercase px-3.5 py-1.5 rounded-full shadow-md tracking-wider">
                {t('menu.soldOut')}
              </span>
            </div>
          )}

          {/* Quick view button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            className="absolute bottom-3 right-3 bg-white/95 hover:bg-white text-brand-chocolate p-2.5 rounded-full shadow-soft opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 duration-200"
            aria-label="View dessert details"
          >
            <Eye className="w-4 h-4 text-brand-chocolate" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-caramel">
                {lang === 'bn' ? product.category_name_bn : product.category_name_en}
              </span>
              {cartItem && (
                <span className="text-[10px] font-bold bg-brand-caramel-subtle text-brand-caramel px-2 py-0.5 rounded-full">
                  {cartItem.quantity} in Bag
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

          {/* Price & Action Row */}
          <div className="pt-3 border-t border-brand-cream-dark/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-brand-taupe-light block leading-none font-medium">
                {hasVariants ? (lang === 'bn' ? 'শুরু মাত্র' : 'Starting from') : t('menu.price')}
              </span>
              <span className="font-heading text-xl font-bold text-brand-chocolate tracking-tight mt-0.5 block">
                ৳{product.base_price}
              </span>
            </div>

            <button
              onClick={handleQuickAdd}
              disabled={!isAvailable}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xs btn-press ${
                justAdded
                  ? 'bg-brand-forest text-white'
                  : !isAvailable
                  ? 'bg-brand-cream-subtle text-brand-taupe/40 cursor-not-allowed'
                  : hasVariants
                  ? 'bg-brand-cream-subtle hover:bg-brand-caramel hover:text-white text-brand-chocolate border border-brand-cream-dark'
                  : 'bg-brand-caramel hover:bg-brand-caramel-hover text-white shadow-soft'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added!</span>
                </>
              ) : hasVariants ? (
                <>
                  <span>{t('menu.customise')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('menu.addToCart')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <ProductDetailModal
          product={product}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
