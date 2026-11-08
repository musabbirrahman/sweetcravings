'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { fetchAdminJson } from '@/lib/adminFetch';
import { Category } from '@/lib/types';
import { useConfirm } from '@/components/DialogProvider';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

interface CategoryRow extends Category {
  productCount: number;
}

export default function AdminCategoriesPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const confirm = useConfirm();

  // Modal form state
  const [nameEn, setNameEn] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionBn, setDescriptionBn] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchCategories = async () => {
    try {
      const { status, data } = await fetchAdminJson('/api/admin/categories');
      // A dead session must go visibly to login, not render an empty list
      // that still looks logged-in.
      if (status === 401) {
        router.push('/admin/login');
        return;
      }
      if (data.success) setCategories(data.categories || []);
    } catch {
      // Leave the previous list in place; the loading state ends below.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setError('');
  };

  // Close the modal with the Escape key. Closing discards unsaved
  // changes, the same as the Cancel button below.
  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const openAddModal = () => {
    setEditing(null);
    setNameEn('');
    setNameBn('');
    setDescriptionEn('');
    setDescriptionBn('');
    setSortOrder('');
    setIsActive(true);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: CategoryRow) => {
    setEditing(cat);
    setNameEn(cat.name_en);
    setNameBn(cat.name_bn);
    setDescriptionEn(cat.description_en || '');
    setDescriptionBn(cat.description_bn || '');
    setSortOrder(String(cat.sort_order));
    setIsActive(cat.active === 1);
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim() || !nameBn.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/categories', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          nameEn,
          nameBn,
          descriptionEn,
          descriptionBn,
          sortOrder,
          active: isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        closeModal();
        setNotice(editing ? 'Category updated.' : 'Category created — it now appears in the dessert form and on the menu.');
        fetchCategories();
      } else {
        setError(data.error || 'Failed to save category');
      }
    } catch {
      setError('Error saving category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (cat: CategoryRow) => {
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, active: cat.active === 1 ? false : true }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice(cat.active === 1 ? `"${cat.name_en}" archived — hidden from the shop.` : `"${cat.name_en}" is active again.`);
        fetchCategories();
      }
    } catch {
      setNotice('Failed to update category');
    }
  };

  const handleDelete = async (cat: CategoryRow) => {
    if (cat.productCount > 0) {
      setNotice(`"${cat.name_en}" still has ${cat.productCount} dessert${cat.productCount === 1 ? '' : 's'} in it. Move or archive those desserts first, or archive the category instead of deleting it.`);
      return;
    }
    const ok = await confirm({
      title: 'Delete this category?',
      message: `Delete the category "${cat.name_en}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/categories?id=${cat.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotice('Category deleted.');
        fetchCategories();
      } else {
        setNotice(data.error || 'Failed to delete category');
      }
    } catch {
      setNotice('Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">

      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            {t('admin.tabCategories')}
          </h1>
          <p className="text-sm text-brand-taupe">
            {t('admin.categoriesSubtitle')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 bg-brand-chocolate hover:bg-brand-chocolate text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-soft transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {notice && (
        <div className="bg-brand-cream border border-[#E7DFD6] text-brand-chocolate text-sm font-medium px-4 py-3 rounded-xl">
          {notice}
        </div>
      )}

      {/* Category list */}
      {loading ? (
        <div className="py-20 text-center text-brand-taupe text-sm">Loading categories...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E7DFD6] shadow-soft overflow-hidden">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border-b border-[#E7DFD6] last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-bold text-brand-chocolate text-sm">
                    {cat.name_en}
                  </span>
                  <span className="text-sm text-brand-caramel font-semibold">{cat.name_bn}</span>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                    cat.active === 1 ? 'bg-brand-forest text-white' : 'bg-brand-chocolate/10 text-brand-taupe'
                  }`}>
                    {cat.active === 1 ? 'Active' : 'Archived'}
                  </span>
                </div>
                <p className="text-sm text-brand-taupe mt-0.5">
                  Web address: /{cat.slug} &nbsp;•&nbsp; Order: {cat.sort_order} &nbsp;•&nbsp; {cat.productCount} dessert{cat.productCount === 1 ? '' : 's'}
                </p>
                {cat.description_en && (
                  <p className="text-sm text-brand-taupe mt-0.5 line-clamp-1">{cat.description_en}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEditModal(cat)}
                  className="flex items-center gap-1 text-sm font-semibold text-brand-chocolate border border-[#E7DFD6] rounded-lg px-3 py-1.5 hover:bg-brand-cream"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(cat)}
                  className="text-sm font-semibold text-brand-caramel border border-[#E7DFD6] rounded-lg px-3 py-1.5 hover:bg-brand-cream"
                >
                  {cat.active === 1 ? 'Archive' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  className="text-brand-taupe/60 hover:text-brand-chocolate p-1.5 rounded transition-colors"
                  title="Delete category"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="py-16 text-center text-brand-taupe text-sm">No categories yet.</div>
          )}
        </div>
      )}

      {/* Add / Edit Category Modal */}
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
            aria-label={editing ? 'Edit category' : 'Add category'}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E7DFD6] pb-3">
              <h2 className="font-heading font-bold text-xl text-brand-chocolate">
                {editing ? `Edit “${editing.name_en}”` : 'Add Category'}
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

            {error && (
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-medium">
                {error}
              </p>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Winter Specials"
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
                    placeholder="যেমন: শীতের স্পেশাল"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
              </div>

              {!editing && nameEn.trim() && (
                <p className="text-sm text-brand-taupe">
                  Web address will be: /{nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
                </p>
              )}
              {editing && (
                <p className="text-sm text-brand-taupe">
                  Web address stays /{editing.slug} even if the name changes.
                </p>
              )}

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
                  <label className="block font-bold text-brand-chocolate mb-1">Order</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    placeholder="Leave empty for last"
                    className="w-full px-3 py-2 rounded-lg border border-[#E7DFD6] bg-brand-cream/50"
                  />
                </div>
                <label className="flex items-center gap-2 pt-6 font-semibold text-brand-chocolate cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-[#9C6237]"
                  />
                  Active (shows on the menu)
                </label>
              </div>

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
                  {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
