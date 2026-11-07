'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { Product, Category } from '@/lib/types';
import { Plus, Search, Trash2 } from 'lucide-react';

export default function AdminProductsPage() {
  const { lang, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New product form state
  const [nameEn, setNameEn] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [basePrice, setBasePrice] = useState('350');
  const [leadTimeEn, setLeadTimeEn] = useState('Same Day (2-3 hours)');
  const [leadTimeBn, setLeadTimeBn] = useState('একই দিনে (২-৩ ঘন্টা)');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionBn, setDescriptionBn] = useState('');
  const [ingredientsEn, setIngredientsEn] = useState('');
  const [ingredientsBn, setIngredientsBn] = useState('');
  const [allergensEn, setAllergensEn] = useState('Contains Milk, Eggs');
  const [allergensBn, setAllergensBn] = useState('দুধ ও ডিম রয়েছে');
  const [imageUrl, setImageUrl] = useState('/sweet-cravings-logo.jpg');

  const fetchCatalog = () => {
    fetch('/api/admin/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setProducts(data.products || []);
          setCategories(data.categories || []);
          if (data.categories && data.categories.length > 0) {
            setCategoryId(data.categories[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === 'published' ? 'sold_out' : 'published';
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, status: newStatus }),
      });
      if (res.ok) {
        fetchCatalog();
      }
    } catch {
      alert('Failed to update status');
    }
  };

  const handleArchive = async (id: number) => {
    if (!confirm('Are you sure you want to archive this dessert? It will be safely hidden from storefront while preserving past orders.')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCatalog();
      }
    } catch {
      alert('Failed to archive product');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn || !nameBn || !basePrice) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          nameEn,
          nameBn,
          descriptionEn,
          descriptionBn,
          ingredientsEn,
          ingredientsBn,
          allergensEn,
          allergensBn,
          leadTimeEn,
          leadTimeBn,
          basePrice,
          imageUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setNameEn('');
        setNameBn('');
        setDescriptionEn('');
        setDescriptionBn('');
        fetchCatalog();
      } else {
        alert(data.error || 'Failed to create product');
      }
    } catch {
      alert('Error creating dessert');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      p.name_en.toLowerCase().includes(q) ||
      p.name_bn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            {t('admin.tabProducts')}
          </h1>
          <p className="text-xs text-brand-taupe">
            Manage your homemade dessert catalog, prices, and availability
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 bg-brand-caramel hover:bg-brand-caramel-dark text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-soft transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('admin.addProduct')}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search dessert name..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-cream-dark bg-white text-xs focus:outline-none focus:border-brand-caramel shadow-soft"
        />
      </div>

      {/* Product Cards Table / Grid */}
      {loading ? (
        <div className="py-20 text-center text-brand-taupe text-sm">
          Loading dessert menu...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isAvailable = p.status === 'published';
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-brand-cream-dark shadow-soft overflow-hidden flex flex-col justify-between"
              >
                <div className="relative h-44 w-full bg-brand-cream-subtle">
                  <Image
                    src={p.image_url || '/sweet-cravings-logo.jpg'}
                    alt={p.name_en}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2.5 right-2.5">
                    <button
                      onClick={() => handleToggleStatus(p)}
                      className={`text-[11px] font-bold px-3 py-1 rounded-full shadow-sm backdrop-blur-md transition-colors ${
                        isAvailable
                          ? 'bg-brand-forest text-white'
                          : 'bg-brand-strawberry text-white'
                      }`}
                      title="Click to toggle availability"
                    >
                      {isAvailable ? 'Available' : 'Sold Out'}
                    </button>
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 bg-[#1F130E]/75 backdrop-blur-md text-brand-gold-light text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10">
                    {p.category_name_en}
                  </div>
                </div>

                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-brand-chocolate text-base">
                      {p.name_en}
                    </h3>
                    <p className="text-xs text-brand-caramel font-semibold">
                      {p.name_bn}
                    </p>
                    <p className="text-xs text-brand-taupe mt-1 line-clamp-2">
                      {p.description_en}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-brand-taupe bg-brand-cream-subtle/50 px-2.5 py-1.5 rounded-lg border border-brand-cream-dark mt-2">
                      <span>Daily Batch Limit: <strong className="text-brand-chocolate">{p.daily_batch_limit ?? 15}</strong></span>
                      <button
                        type="button"
                        onClick={async () => {
                          const val = prompt('Enter daily batch limit:', String(p.daily_batch_limit ?? 15));
                          if (val && !isNaN(parseInt(val, 10))) {
                            await fetch('/api/admin/products', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: p.id, dailyBatchLimit: parseInt(val, 10) })
                            });
                            fetchCatalog();
                          }
                        }}
                        className="text-brand-caramel font-semibold hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-brand-cream-dark flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-brand-chocolate">
                      ৳{p.base_price}
                    </span>

                    <button
                      onClick={() => handleArchive(p.id)}
                      className="text-brand-taupe/60 hover:text-brand-strawberry p-1 rounded transition-colors"
                      title="Safe Archive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A110E]/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl animate-fadeIn border border-brand-cream-dark">
            <h2 className="font-heading font-bold text-xl text-brand-chocolate border-b border-brand-cream-dark pb-3">
              {t('admin.addProduct')}
            </h2>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Pistachio Kheer"
                    className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-brand-cream-subtle/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Name (Bangla) *</label>
                  <input
                    type="text"
                    required
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="যেমন: পেস্তা ক্ষীর"
                    className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-brand-cream-subtle/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name_en} ({c.name_bn})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Base Price (৳ BDT) *</label>
                  <input
                    type="number"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark font-mono bg-brand-cream-subtle/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Lead Time (English)</label>
                  <input
                    type="text"
                    value={leadTimeEn}
                    onChange={(e) => setLeadTimeEn(e.target.value)}
                    placeholder="e.g. 4 hours lead time"
                    className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-brand-cream-subtle/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Lead Time (Bangla)</label>
                  <input
                    type="text"
                    value={leadTimeBn}
                    onChange={(e) => setLeadTimeBn(e.target.value)}
                    placeholder="যেমন: ৪ ঘন্টা সময় প্রয়োজন"
                    className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-brand-cream-subtle/50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Image URL / Preset</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="/sweet-cravings-logo.jpg or https://..."
                  className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-brand-cream-subtle/50"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Description (English)</label>
                <textarea
                  rows={2}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-brand-cream-subtle/50"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Description (Bangla)</label>
                <textarea
                  rows={2}
                  value={descriptionBn}
                  onChange={(e) => setDescriptionBn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-cream-dark bg-brand-cream-subtle/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-brand-cream-dark">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-brand-cream-dark text-brand-taupe font-semibold hover:bg-brand-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-caramel hover:bg-brand-caramel-dark text-white px-5 py-2 rounded-lg font-bold shadow-soft"
                >
                  {submitting ? 'Saving...' : 'Add Dessert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
