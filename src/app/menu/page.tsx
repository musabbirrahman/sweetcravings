'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import ProductCard from '@/components/ProductCard';
import { Product, Category } from '@/lib/types';
import { 
  Search, 
  Sparkles, 
  X, 
  SlidersHorizontal, 
  Clock, 
  ShieldCheck, 
  Cake
} from 'lucide-react';

function MenuContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProducts(data.products || []);
          setCategories(data.categories || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (categoryParam) {
      const parsed = parseInt(categoryParam, 10);
      if (!isNaN(parsed)) {
        setSelectedCategory(parsed);
      }
    }
  }, [categoryParam]);

  // Compute category product counts
  const categoryCounts = useMemo(() => {
    const counts: Record<number | string, number> = { all: products.length };
    products.forEach((p) => {
      counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Filtered and Sorted list
  const filteredProducts = useMemo(() => {
    let result = products.filter((prod) => {
      const matchesCategory = selectedCategory === 'all' || prod.category_id === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        prod.name_en.toLowerCase().includes(q) || 
        prod.name_bn.toLowerCase().includes(q) ||
        (prod.description_en && prod.description_en.toLowerCase().includes(q)) ||
        (prod.description_bn && prod.description_bn.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });

    if (sortBy === 'price-asc') {
      result = [...result].sort((a, b) => a.base_price - b.base_price);
    } else if (sortBy === 'price-desc') {
      result = [...result].sort((a, b) => b.base_price - a.base_price);
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-8 font-sans">
      
      {/* Header Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-3 relative">
        <div className="inline-flex items-center gap-1.5 bg-brand-caramel-subtle text-brand-caramel text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'তাজা ঘরোয়া মেনু' : 'Fresh Homemade Patisserie'}</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-5xl font-semibold text-brand-chocolate tracking-tight">
          {t('menu.title')}
        </h1>
        <p className="text-sm sm:text-base text-brand-taupe leading-[1.78]">
          {t('menu.subtitle')}
        </p>

        {/* Lead time & Freshness reassurance chip */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-brand-taupe">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-caramel" />
            <span>{lang === 'bn' ? 'অর্ডার পাওয়ার পর তাজা বেকিং' : 'Baked fresh upon order'}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-forest" />
            <span>{lang === 'bn' ? '১০০% খাঁটি ও প্রাকৃতিক উপাদান' : '100% Pure Dairy & Butter'}</span>
          </span>
        </div>
      </div>

      {/* Filter, Search and Sort Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-brand-cream-dark shadow-soft space-y-4">
        
        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          
          {/* Search Input with Instant Clear */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('menu.searchPlaceholder')}
              className="w-full pl-10 pr-10 py-2.5 rounded-full border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel focus:ring-2 focus:ring-brand-caramel-subtle text-sm text-brand-chocolate placeholder:text-brand-taupe/60 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-brand-taupe hover:text-brand-chocolate hover:bg-brand-cream-dark/30 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selection */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-brand-taupe hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-full border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-xs font-semibold text-brand-chocolate cursor-pointer transition-all"
            >
              <option value="featured">{lang === 'bn' ? 'জনপ্রিয় ডেজার্ট' : 'Featured Desserts'}</option>
              <option value="price-asc">{lang === 'bn' ? 'মূল্য: কম থেকে বেশি' : 'Price: Low to High'}</option>
              <option value="price-desc">{lang === 'bn' ? 'মূল্য: বেশি থেকে কম' : 'Price: High to Low'}</option>
            </select>
          </div>
        </div>

        {/* Categories Tab Scroll with Dynamic Item Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none justify-start sm:justify-center border-t border-brand-cream-dark/60 pt-3">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-brand-caramel text-white shadow-soft'
                : 'bg-brand-cream-subtle/70 text-brand-chocolate hover:bg-brand-cream border border-transparent'
            }`}
          >
            <span>{t('menu.allCategories')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-brand-cream-dark/60 text-brand-taupe'
            }`}>
              {categoryCounts.all || 0}
            </span>
          </button>
          
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand-caramel text-white shadow-soft'
                    : 'bg-brand-cream-subtle/70 text-brand-chocolate hover:bg-brand-cream border border-transparent'
                }`}
              >
                <span>{lang === 'bn' ? cat.name_bn : cat.name_en}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-brand-cream-dark/60 text-brand-taupe'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Result Count Banner */}
      <div className="flex items-center justify-between text-xs text-brand-taupe px-1">
        <span>
          {lang === 'bn' 
            ? `${filteredProducts.length}টি তাজা মিষ্টি দেখাচ্ছে` 
            : `Showing ${filteredProducts.length} artisan desserts`}
        </span>
        {searchQuery && (
          <span className="italic">
            Search: &ldquo;{searchQuery}&rdquo;
          </span>
        )}
      </div>

      {/* Product List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-3xl h-80 animate-pulse border border-brand-cream-dark" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-brand-cream-dark p-8 space-y-4 shadow-soft max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-brand-cream-subtle flex items-center justify-center text-brand-caramel">
            <Cake className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-brand-chocolate">
              {lang === 'bn' ? 'কোনো ডেজার্ট পাওয়া যায়নি' : 'No Desserts Found'}
            </h3>
            <p className="text-brand-taupe text-xs">
              {t('menu.empty')}
            </p>
          </div>
          <button
            onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
            className="inline-flex items-center gap-1.5 bg-brand-caramel text-white text-xs font-bold py-2.5 px-6 rounded-full shadow-soft hover:bg-brand-caramel-dark transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'সকল ডেজার্ট দেখুন' : 'Show All Sweets'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

    </div>
  );
}

export default function MenuPage() {
  return (
    <React.Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-20 text-center text-brand-taupe text-sm">Loading desserts...</div>}>
      <MenuContent />
    </React.Suspense>
  );
}
