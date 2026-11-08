'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { fetchAdminJson } from '@/lib/adminFetch';
import { Product, Category } from '@/lib/types';
import { useConfirm, useToast } from '@/components/DialogProvider';
import { Plus, Search, Trash2, Pencil, X } from 'lucide-react';

export default function AdminProductsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  // Edit-mode state (only used when editing an existing dessert)
  const [status, setStatus] = useState<'published' | 'sold_out' | 'draft'>('published');
  const [variants, setVariants] = useState<{ labelEn: string; labelBn: string; priceAdjustment: string }[]>([]);

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
  // Photo upload: a file chosen here is resized in the browser and
  // uploaded when the dessert is saved, and its URL replaces the text
  // field below. The server cannot resize (no sharp on Cloudflare),
  // so the resize happens here — see resizePhotoForUpload.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Resize a photo in the browser before upload: at most 1200px wide,
  // JPEG quality 80, on a white background (so PNG transparency becomes
  // white, not black). The server stores the bytes as received — on
  // Cloudflare it cannot resize (no sharp, no disk). Falls back to the
  // original file if the browser cannot resize it.
  const resizePhotoForUpload = async (file: File): Promise<Blob> => {
    try {
      if (typeof createImageBitmap === 'undefined') return file;
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, 1200 / bitmap.width);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
      );
      return blob ?? file;
    } catch {
      return file;
    }
  };

  const handlePhotoSelect = (file: File | null) => {
    setPhotoError('');
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Only JPG, PNG or WebP photos are accepted.');
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('That photo is too large. Please choose one under 5 MB.');
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const resetPhotoState = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError('');
    setUploadingPhoto(false);
  };

  const resetForm = () => {
    setNameEn('');
    setNameBn('');
    setDescriptionEn('');
    setDescriptionBn('');
    setIngredientsEn('');
    setIngredientsBn('');
    setAllergensEn('Contains Milk, Eggs');
    setAllergensBn('দুধ ও ডিম রয়েছে');
    setLeadTimeEn('Same Day (2-3 hours)');
    setLeadTimeBn('একই দিনে (২-৩ ঘন্টা)');
    setBasePrice('350');
    setImageUrl('/sweet-cravings-logo.jpg');
    setStatus('published');
    setVariants([]);
    resetPhotoState();
  };

  const closeModal = () => {
    // Closing discards unsaved changes, the same as the Cancel button.
    setIsModalOpen(false);
    setEditingProduct(null);
    resetForm();
  };

  // Close the modal with the Escape key.
  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const openAddModal = () => {
    resetForm();
    if (categories.length > 0) setCategoryId(categories[0].id);
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setNameEn(product.name_en);
    setNameBn(product.name_bn);
    setCategoryId(product.category_id);
    setBasePrice(String(product.base_price));
    setLeadTimeEn(product.lead_time_en || '');
    setLeadTimeBn(product.lead_time_bn || '');
    setDescriptionEn(product.description_en || '');
    setDescriptionBn(product.description_bn || '');
    setIngredientsEn(product.ingredients_en || '');
    setIngredientsBn(product.ingredients_bn || '');
    setAllergensEn(product.allergens_en || '');
    setAllergensBn(product.allergens_bn || '');
    setImageUrl(product.image_url || '/sweet-cravings-logo.jpg');
    setStatus(product.status === 'archived' ? 'draft' : product.status);
    setVariants(
      (product.variants || []).map((v) => ({
        labelEn: v.label_en,
        labelBn: v.label_bn,
        priceAdjustment: String(v.price_adjustment || 0),
      }))
    );
    resetPhotoState();
    setIsModalOpen(true);
  };

  const fetchCatalog = async () => {
    try {
      const { status, data } = await fetchAdminJson('/api/admin/products');
      // A dead session must go visibly to login, not render an empty menu
      // that still looks logged-in.
      if (status === 401) {
        router.push('/admin/login');
        return;
      }
      if (data.success) {
        setProducts(data.products || []);
        setCategories(data.categories || []);
        if (data.categories && data.categories.length > 0) {
          setCategoryId(data.categories[0].id);
        }
      }
    } catch {
      // Leave the previous list in place; the loading state ends below.
    } finally {
      setLoading(false);
    }
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
      toast('Failed to update status', 'error');
    }
  };

  const handleArchive = async (id: number) => {
    const ok = await confirm({
      title: 'Archive this dessert?',
      message: 'It will be safely hidden from the storefront while preserving past orders.',
      confirmLabel: 'Archive',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCatalog();
      }
    } catch {
      toast('Failed to archive product', 'error');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn || !nameBn || !basePrice) return;

    setSubmitting(true);
    try {
      // If a photo file was chosen, resize it in the browser and upload
      // it first, and use the returned URL for the dessert.
      // The text URL field below is only the fallback when no file is chosen.
      let finalImageUrl = imageUrl;
      if (photoFile) {
        setUploadingPhoto(true);
        const resized = await resizePhotoForUpload(photoFile);
        const formData = new FormData();
        formData.append('photo', resized, photoFile.name);
        const uploadRes = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        setUploadingPhoto(false);
        if (!uploadRes.ok || !uploadData.success || !uploadData.url) {
          toast(uploadData.error || 'Photo upload failed. Please try a different photo.', 'error');
          setSubmitting(false);
          return;
        }
        finalImageUrl = uploadData.url;
      }

      const cleanVariants = variants
        .filter((v) => v.labelEn.trim() && v.labelBn.trim())
        .map((v) => ({
          labelEn: v.labelEn.trim(),
          labelBn: v.labelBn.trim(),
          priceAdjustment: parseInt(v.priceAdjustment || '0', 10) || 0,
        }));

      const payload = {
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
        imageUrl: finalImageUrl,
        variants: cleanVariants,
      };

      const res = await fetch(
        '/api/admin/products',
        editingProduct
          ? {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...payload, id: editingProduct.id, status }),
            }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
      );
      const data = await res.json();
      if (data.success) {
        closeModal();
        fetchCatalog();
      } else {
        toast(data.error || 'Failed to save dessert', 'error');
      }
    } catch {
      toast('Error saving dessert', 'error');
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
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
          <p className="text-sm text-brand-taupe">
            {t('admin.productsSubtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 bg-brand-chocolate hover:bg-brand-chocolate text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-soft transition-all self-start sm:self-auto"
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
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E7DFD6] bg-white text-sm focus:outline-none focus:border-brand-caramel shadow-soft"
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
                className="bg-white rounded-2xl border border-[#E7DFD6] shadow-soft overflow-hidden flex flex-col justify-between"
              >
                <div className="relative h-44 w-full bg-brand-cream">
                  <Image
                    src={p.image_url || '/sweet-cravings-logo.jpg'}
                    alt={p.name_en}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2.5 right-2.5">
                    <button
                      onClick={() => handleToggleStatus(p)}
                      className={`text-sm font-bold px-3 py-1 rounded-full shadow-sm backdrop-blur-md transition-colors ${
                        isAvailable
                          ? 'bg-brand-forest text-white'
                          : 'bg-brand-chocolate text-white'
                      }`}
                      title="Click to toggle availability"
                    >
                      {isAvailable ? 'Available' : 'Sold Out'}
                    </button>
                  </div>
                  <div className="absolute bottom-2.5 left-2.5 bg-brand-chocolate/75 backdrop-blur-md text-brand-cream text-sm font-medium px-2 py-0.5 rounded-full border border-white/10">
                    {p.category_name_en}
                  </div>
                </div>

                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-brand-chocolate text-base">
                      {p.name_en}
                    </h3>
                    <p className="text-sm text-brand-caramel font-semibold">
                      {p.name_bn}
                    </p>
                    <p className="text-sm text-brand-taupe mt-1 line-clamp-2">
                      {p.description_en}
                    </p>

                    <div className="flex items-center justify-between text-sm text-brand-taupe bg-brand-cream/50 px-2.5 py-1.5 rounded-lg border border-[#E7DFD6] mt-2">
                      <span>Daily Batch Limit: <strong className="text-brand-chocolate">{p.daily_batch_limit ?? 15}</strong></span>
                      <button
                        type="button"
                        onClick={async () => {
                          const val = await confirm({
                            title: 'Daily batch limit',
                            message: `How many of this dessert can be baked today?`,
                            confirmLabel: 'Save limit',
                            input: { label: 'Daily batch limit', defaultValue: String(p.daily_batch_limit ?? 15), required: true, inputType: 'number' },
                          });
                          if (typeof val === 'string' && val.trim() && !isNaN(parseInt(val, 10))) {
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

                  <div className="pt-3 border-t border-[#E7DFD6] flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-brand-chocolate">
                      ৳{p.base_price}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(p)}
                        className="flex items-center gap-1 text-sm font-semibold text-brand-chocolate border border-[#E7DFD6] rounded-lg px-2.5 py-1.5 hover:bg-brand-cream"
                        title="Edit dessert"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchive(p.id)}
                        className="text-brand-taupe/60 hover:text-brand-chocolate p-1.5 rounded transition-colors"
                        title="Safe Archive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div
          // !mt-0: this page's root uses space-y-6, whose margin would
          // otherwise push this fixed overlay 24px down and leave a
          // strip at the top of the screen where taps miss the backdrop.
          className="fixed inset-0 !mt-0 z-50 flex items-center justify-center p-4 bg-[#1A110E]/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl animate-fadeIn border border-[#E7DFD6]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct ? 'Edit dessert' : 'Add dessert'}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E7DFD6] pb-3">
              <h2 className="font-heading font-bold text-xl text-brand-chocolate">
                {editingProduct ? `Edit “${editingProduct.name_en}”` : t('admin.addProduct')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="p-2 -m-1 text-brand-taupe hover:text-brand-chocolate hover:bg-brand-cream rounded-full transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Pistachio Kheer"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
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
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Category *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-white"
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
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] font-mono bg-brand-cream/50"
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
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Lead Time (Bangla)</label>
                  <input
                    type="text"
                    value={leadTimeBn}
                    onChange={(e) => setLeadTimeBn(e.target.value)}
                    placeholder="যেমন: ৪ ঘন্টা সময় প্রয়োজন"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Photo — upload a file</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handlePhotoSelect(e.target.files ? e.target.files[0] : null)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-white text-brand-chocolate file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-caramel/10 file:text-brand-chocolate file:font-bold file:text-sm"
                />
                <p className="text-sm text-brand-taupe mt-1">JPG, PNG or WebP, under 5 MB. It is resized to at most 1200px wide when saved.</p>
                {photoError && (
                  <p className="text-sm text-brand-chocolate font-semibold mt-1">{photoError}</p>
                )}
                {photoPreview && (
                  <div className="mt-2 relative w-full h-40 rounded-xl overflow-hidden border border-[#E7DFD6] bg-brand-cream">
                    <Image src={photoPreview} alt="Photo preview" fill className="object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Image URL / Preset (fallback if no file uploaded)</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="/sweet-cravings-logo.jpg or https://..."
                  className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                />
                {imageUrl && !photoPreview && (
                  <div className="mt-2 relative w-full h-40 rounded-xl overflow-hidden border border-[#E7DFD6] bg-brand-cream">
                    <Image src={imageUrl} alt="Image preview" fill className="object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Description (English)</label>
                <textarea
                  rows={2}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Description (Bangla)</label>
                <textarea
                  rows={2}
                  value={descriptionBn}
                  onChange={(e) => setDescriptionBn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Ingredients (English)</label>
                  <textarea
                    rows={2}
                    value={ingredientsEn}
                    onChange={(e) => setIngredientsEn(e.target.value)}
                    placeholder="e.g. Fresh milk, eggs, sugar..."
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Ingredients (Bangla)</label>
                  <textarea
                    rows={2}
                    value={ingredientsBn}
                    onChange={(e) => setIngredientsBn(e.target.value)}
                    placeholder="যেমন: তাজা দুধ, ডিম, চিনি..."
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Allergen note (English)</label>
                  <input
                    type="text"
                    value={allergensEn}
                    onChange={(e) => setAllergensEn(e.target.value)}
                    placeholder="e.g. Contains Milk, Eggs"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Allergen note (Bangla)</label>
                  <input
                    type="text"
                    value={allergensBn}
                    onChange={(e) => setAllergensBn(e.target.value)}
                    placeholder="যেমন: দুধ ও ডিম রয়েছে"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
              </div>

              {/* Sizes / options (variants). Empty rows are ignored on save. */}
              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Sizes / Options</label>
                {variants.length === 0 && (
                  <p className="text-sm text-brand-taupe mb-2">No sizes yet — the dessert sells at the base price above.</p>
                )}
                <div className="space-y-2">
                  {variants.map((v, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_70px_28px] gap-2 items-center">
                      <input
                        type="text"
                        value={v.labelEn}
                        onChange={(e) => setVariants(variants.map((x, i) => (i === idx ? { ...x, labelEn: e.target.value } : x)))}
                        placeholder="Size (English)"
                        className="w-full px-2 py-1.5 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                      />
                      <input
                        type="text"
                        value={v.labelBn}
                        onChange={(e) => setVariants(variants.map((x, i) => (i === idx ? { ...x, labelBn: e.target.value } : x)))}
                        placeholder="সাইজ (বাংলা)"
                        className="w-full px-2 py-1.5 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                      />
                      <input
                        type="number"
                        value={v.priceAdjustment}
                        onChange={(e) => setVariants(variants.map((x, i) => (i === idx ? { ...x, priceAdjustment: e.target.value } : x)))}
                        placeholder="+৳"
                        title="Extra price over the base price (৳)"
                        className="w-full px-2 py-1.5 rounded-lg border border-[#E7DFD6] bg-brand-cream/50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                        aria-label="Remove size"
                        className="p-1.5 text-brand-taupe hover:text-brand-chocolate rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setVariants([...variants, { labelEn: '', labelBn: '', priceAdjustment: '0' }])}
                  className="mt-2 text-brand-caramel font-semibold hover:underline"
                >
                  + Add a size / option
                </button>
              </div>

              {editingProduct && (
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Availability</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'published' | 'sold_out' | 'draft')}
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-white"
                  >
                    <option value="published">Available</option>
                    <option value="sold_out">Sold Out</option>
                    <option value="draft">Draft (hidden)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DFD6]">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-[#E7DFD6] text-brand-taupe font-semibold hover:bg-brand-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-chocolate hover:bg-brand-chocolate text-white px-5 py-2 rounded-lg font-bold shadow-soft"
                >
                  {uploadingPhoto ? 'Uploading photo...' : submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Dessert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
