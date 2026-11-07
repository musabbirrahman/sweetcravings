'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { ShopSettings, Coupon } from '@/lib/types';
import { 
  Save, 
  Download, 
  Check, 
  Bell, 
  Tag, 
  Plus, 
  Trash2, 
  Send, 
  AlertCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Backup restore: a file chosen here replaces ALL current shop data
  // (menu, orders, settings) with the backup's contents. Coupons are
  // not part of a backup and are left untouched.
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [deliveryFee, setDeliveryFee] = useState('50');
  const [freeThreshold, setFreeThreshold] = useState('1200');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [codEnabled, setCodEnabled] = useState(true);

  // bKash
  const [bkashEnabled, setBkashEnabled] = useState(true);
  const [bkashNumber, setBkashNumber] = useState('');
  const [bkashType, setBkashType] = useState<'personal' | 'merchant'>('personal');

  // Nagad
  const [nagadEnabled, setNagadEnabled] = useState(true);
  const [nagadNumber, setNagadNumber] = useState('');
  const [nagadType, setNagadType] = useState<'personal' | 'merchant'>('personal');

  // Statements
  const [coverageEn, setCoverageEn] = useState('');
  const [coverageBn, setCoverageBn] = useState('');

  // Notifications (Telegram & SMS)
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [testingNotification, setTestingNotification] = useState(false);
  const [testNotificationMsg, setTestNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [newDiscountVal, setNewDiscountVal] = useState('50');
  const [newMinOrder, setNewMinOrder] = useState('400');
  const [newMaxDiscount, setNewMaxDiscount] = useState('');
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  const fetchSettings = () => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.settings) {
          const s: ShopSettings = data.settings;
          setSettings(s);
          setDeliveryFee(String(s.delivery_fee));
          setFreeThreshold(String(s.free_delivery_threshold));
          setWhatsappNumber(s.whatsapp_number);
          setCodEnabled(s.cod_enabled);
          setBkashEnabled(s.bkash_enabled);
          setBkashNumber(s.bkash_number);
          setBkashType(s.bkash_type);
          setNagadEnabled(s.nagad_enabled);
          setNagadNumber(s.nagad_number);
          setNagadType(s.nagad_type);
          setCoverageEn(s.coverage_statement_en);
          setCoverageBn(s.coverage_statement_bn);
          setTelegramToken(s.telegram_bot_token || '');
          setTelegramChatId(s.telegram_chat_id || '');
          setNotificationsEnabled(s.notifications_enabled !== false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchCoupons = () => {
    fetch('/api/admin/coupons')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.coupons) {
          setCoupons(data.coupons);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCoupons(false));
  };

  useEffect(() => {
    fetchSettings();
    fetchCoupons();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (settings && (bkashNumber !== settings.bkash_number || nagadNumber !== settings.nagad_number)) {
      const confirmed = window.confirm(
        `Please confirm wallet number changes:\nbKash: ${bkashNumber}\nNagad: ${nagadNumber}\nAre these correct?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            delivery_fee: deliveryFee,
            free_delivery_threshold: freeThreshold,
            whatsapp_number: whatsappNumber,
            cod_enabled: codEnabled ? 'true' : 'false',
            bkash_enabled: bkashEnabled ? 'true' : 'false',
            bkash_number: bkashNumber,
            bkash_type: bkashType,
            nagad_enabled: nagadEnabled ? 'true' : 'false',
            nagad_number: nagadNumber,
            nagad_type: nagadType,
            coverage_statement_en: coverageEn,
            coverage_statement_bn: coverageBn,
            telegram_bot_token: telegramToken,
            telegram_chat_id: telegramChatId,
            notifications_enabled: notificationsEnabled ? 'true' : 'false',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessNotice(true);
        setTimeout(() => setSuccessNotice(false), 3000);
        fetchSettings();
      }
    } catch {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    setTestNotificationMsg(null);
    try {
      const res = await fetch('/api/admin/notifications/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTestNotificationMsg({ type: 'success', text: data.message });
      } else {
        setTestNotificationMsg({ type: 'error', text: data.error || 'Failed to dispatch test notification.' });
      }
    } catch (err: any) {
      setTestNotificationMsg({ type: 'error', text: err.message || 'Connection error' });
    } finally {
      setTestingNotification(false);
    }
  };

  const handleToggleCoupon = async (id: number, currentActive: number) => {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: currentActive ? 0 : 1 }),
      });
      if (res.ok) fetchCoupons();
    } catch {}
  };

  const handleDeleteCoupon = async (id: number, code: string) => {
    if (!window.confirm(`Delete coupon "${code}"?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchCoupons();
    } catch {}
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;

    setCreatingCoupon(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCouponCode.trim(),
          discountType: newDiscountType,
          discountValue: newDiscountVal,
          minOrderAmount: newMinOrder,
          maxDiscountAmount: newMaxDiscount || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewCouponCode('');
        setShowAddCoupon(false);
        fetchCoupons();
      } else {
        alert(data.error || 'Failed to create coupon');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating coupon');
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleBackupDownload = () => {
    window.open('/api/admin/settings?backup=true', '_blank');
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    // Explicit confirmation: a restore replaces everything currently
    // in the shop (menu, orders, settings) with the backup's contents.
    const confirmed = window.confirm(
      `Restore this backup (${restoreFile.name})?\n\nThis REPLACES all current shop data — menu, orders and settings — with the backup's contents. Today's orders and changes made after the backup will be lost. Coupons are not part of a backup and stay as they are.\n\nAre you sure?`
    );
    if (!confirmed) return;

    setRestoring(true);
    setRestoreMsg(null);
    try {
      const formData = new FormData();
      formData.append('backup', restoreFile);
      const res = await fetch('/api/admin/settings/restore', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRestoreMsg({ type: 'success', text: data.message || 'Backup restored.' });
        setRestoreFile(null);
        fetchSettings();
      } else {
        setRestoreMsg({ type: 'error', text: data.error || 'Restore failed. Nothing was changed.' });
      }
    } catch (err: any) {
      setRestoreMsg({ type: 'error', text: err.message || 'Restore failed. Nothing was changed.' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl font-sans">
      
      {/* Title & Backup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-chocolate/10 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            {t('admin.tabSettings')}
          </h1>
          <p className="text-xs text-brand-taupe mt-0.5">
            Configure delivery fees, payment wallets, kitchen notifications, and promo codes
          </p>
        </div>

        <button
          onClick={handleBackupDownload}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-brand-cream border border-brand-chocolate/10 text-brand-chocolate text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-brand-caramel" />
          <span>Download JSON Backup</span>
        </button>
      </div>

      {successNotice && (
        <div className="bg-brand-forest/10 border border-brand-forest/20 text-brand-forest p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* Restore Backup */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-chocolate/10 shadow-soft space-y-3">
        <h2 className="font-heading font-bold text-base text-brand-chocolate border-b border-brand-chocolate/10 pb-3">
          Restore from Backup
        </h2>
        <p className="text-xs text-brand-taupe leading-relaxed">
          Choose a backup JSON file downloaded from this shop. Restoring replaces all current
          menu, orders and settings with the backup&apos;s contents. The file is checked first —
          if it is not a valid backup, nothing changes. Coupons are not part of a backup and stay as they are.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => { setRestoreFile(e.target.files ? e.target.files[0] : null); setRestoreMsg(null); }}
            className="flex-1 px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white text-xs text-brand-chocolate file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-caramel/10 file:text-brand-chocolate file:font-bold file:text-xs"
          />
          <button
            type="button"
            onClick={handleRestore}
            disabled={!restoreFile || restoring}
            className="bg-brand-chocolate hover:bg-brand-caramel text-white px-5 py-2 rounded-lg text-xs font-bold shadow-soft disabled:opacity-40 transition-colors"
          >
            {restoring ? 'Restoring...' : 'Restore Backup'}
          </button>
        </div>
        {restoreFile && (
          <p className="text-[11px] text-brand-taupe">Selected: <strong className="text-brand-chocolate">{restoreFile.name}</strong></p>
        )}
        {restoreMsg && (
          <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            restoreMsg.type === 'success'
              ? 'bg-brand-forest/10 border border-brand-forest/20 text-brand-forest'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {restoreMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{restoreMsg.text}</span>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Delivery Rates */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-chocolate/10 shadow-soft space-y-4">
          <h2 className="font-heading font-bold text-base text-brand-chocolate border-b border-brand-chocolate/10 pb-3">
            Rajshahi Delivery Fees
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-brand-chocolate mb-1">Standard Delivery Fee (BDT)</label>
              <input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-brand-cream/50"
              />
            </div>

            <div>
              <label className="block font-bold text-brand-chocolate mb-1">Free Delivery Order Threshold (BDT)</label>
              <input
                type="number"
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-brand-cream/50"
              />
            </div>
          </div>
        </div>

        {/* Instant Kitchen Notifications (Telegram / SMS) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-chocolate/10 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-brand-chocolate/10 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-caramel" />
              <h2 className="font-heading font-bold text-base text-brand-chocolate">
                Instant Kitchen Order Notifications
              </h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-chocolate">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="rounded text-brand-caramel focus:ring-brand-caramel"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="text-xs text-brand-taupe space-y-3">
            <p className="leading-relaxed">
              Receive a private instant push alert on your phone the moment a customer places an order.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-brand-chocolate mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="e.g. 123456789:ABCdefGhIJKlmNo"
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-brand-cream/50 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. 987654321"
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-brand-cream/50 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-brand-taupe">
                Tip: Create a free bot on Telegram via @BotFather and get your chat ID from @userinfobot.
              </p>

              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testingNotification || !telegramToken || !telegramChatId}
                className="inline-flex items-center gap-1.5 bg-brand-cream hover:bg-brand-cream text-brand-chocolate border border-brand-chocolate/10 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors self-start disabled:opacity-50"
              >
                <Send className="w-3 h-3 text-brand-caramel" />
                <span>{testingNotification ? 'Sending...' : 'Test Kitchen Alert'}</span>
              </button>
            </div>

            {testNotificationMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                testNotificationMsg.type === 'success'
                  ? 'bg-brand-forest/10 text-brand-forest border border-brand-forest/20'
                  : 'bg-brand-caramel/10 text-brand-chocolate border border-brand-chocolate/20'
              }`}>
                {testNotificationMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{testNotificationMsg.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* bKash & Nagad Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* bKash */}
          <div className="bg-white p-5 rounded-2xl border border-brand-chocolate/10 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b border-brand-chocolate/10 pb-2.5">
              <span className="font-heading font-bold text-sm text-[#8C1347]">bKash Configuration</span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={bkashEnabled}
                  onChange={(e) => setBkashEnabled(e.target.checked)}
                  className="rounded text-[#E2136E]"
                />
                <span>Active</span>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Account Number</label>
                <input
                  type="text"
                  value={bkashNumber}
                  onChange={(e) => setBkashNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-brand-cream/50 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Type</label>
                <select
                  value={bkashType}
                  onChange={(e) => setBkashType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white"
                >
                  <option value="personal">Personal (Send Money)</option>
                  <option value="merchant">Merchant (Make Payment)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nagad */}
          <div className="bg-white p-5 rounded-2xl border border-brand-chocolate/10 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b border-brand-chocolate/10 pb-2.5">
              <span className="font-heading font-bold text-sm text-[#A35200]">Nagad Configuration</span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={nagadEnabled}
                  onChange={(e) => setNagadEnabled(e.target.checked)}
                  className="rounded text-[#F7941D]"
                />
                <span>Active</span>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Account Number</label>
                <input
                  type="text"
                  value={nagadNumber}
                  onChange={(e) => setNagadNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-brand-cream/50 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Type</label>
                <select
                  value={nagadType}
                  onChange={(e) => setNagadType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white"
                >
                  <option value="personal">Personal (Send Money)</option>
                  <option value="merchant">Merchant (Make Payment)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Contact & COD */}
        <div className="bg-white p-5 rounded-2xl border border-brand-chocolate/10 shadow-soft space-y-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-brand-cream/50 border border-brand-chocolate/10">
            <div>
              <span className="font-bold text-brand-chocolate block">Cash on Delivery (COD)</span>
              <span className="text-brand-taupe text-[11px]">Customers pay cash upon doorstep delivery</span>
            </div>
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-brand-caramel focus:ring-brand-caramel cursor-pointer"
            />
          </div>

          <div>
            <label className="block font-bold text-brand-chocolate mb-1">Official WhatsApp Concierge Number</label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-brand-cream/50 font-mono text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-brand-caramel hover:bg-brand-caramel text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-soft transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : t('admin.saveChanges')}</span>
        </button>
      </form>

      {/* Promo Codes & Coupons Management Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-chocolate/10 shadow-soft space-y-5">
        <div className="flex items-center justify-between border-b border-brand-chocolate/10 pb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-caramel" />
            <h2 className="font-heading font-bold text-base text-brand-chocolate">
              Promo Codes & Discount Coupons
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCoupon(!showAddCoupon)}
            className="inline-flex items-center gap-1 bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddCoupon ? 'Cancel' : 'New Coupon'}</span>
          </button>
        </div>

        {/* Add Coupon Form Drawer */}
        {showAddCoupon && (
          <form onSubmit={handleCreateCoupon} className="p-4 bg-brand-cream/60 rounded-2xl border border-brand-chocolate/10 space-y-3 animate-fadeIn text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SPECIAL50"
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Discount Type</label>
                <select
                  value={newDiscountType}
                  onChange={(e) => setNewDiscountType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white"
                >
                  <option value="fixed">Fixed BDT Amount (৳)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-brand-chocolate mb-1">
                  Discount Value {newDiscountType === 'fixed' ? '(BDT ৳)' : '(%)'}
                </label>
                <input
                  type="number"
                  required
                  value={newDiscountVal}
                  onChange={(e) => setNewDiscountVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-brand-chocolate mb-1">Min Order Amount (BDT)</label>
                <input
                  type="number"
                  value={newMinOrder}
                  onChange={(e) => setNewMinOrder(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white"
                />
              </div>

              {newDiscountType === 'percentage' && (
                <div>
                  <label className="block font-bold text-brand-chocolate mb-1">Max Discount Cap (BDT)</label>
                  <input
                    type="number"
                    value={newMaxDiscount}
                    onChange={(e) => setNewMaxDiscount(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 rounded-lg border border-brand-chocolate/10 bg-white"
                  />
                </div>
              )}
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="submit"
                disabled={creatingCoupon}
                className="bg-brand-forest hover:bg-brand-chocolate text-white px-5 py-2 rounded-xl font-bold transition-all"
              >
                {creatingCoupon ? 'Creating...' : 'Save Coupon'}
              </button>
            </div>
          </form>
        )}

        {/* Coupons List Table */}
        <div className="space-y-2">
          {loadingCoupons ? (
            <p className="text-xs text-brand-taupe py-4 text-center">Loading promo codes...</p>
          ) : coupons.length === 0 ? (
            <p className="text-xs text-brand-taupe py-4 text-center">No promo codes created yet.</p>
          ) : (
            <div className="space-y-2">
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border border-brand-chocolate/10 flex items-center justify-between gap-3 text-xs bg-white hover:bg-brand-cream/30 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-brand-chocolate tracking-wider">
                        {c.code}
                      </span>
                      <span className="bg-brand-caramel/10 text-brand-caramel font-bold px-2 py-0.5 rounded text-[10px]">
                        {c.discount_type === 'fixed' ? `৳${c.discount_value} OFF` : `${c.discount_value}% OFF`}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.active ? 'bg-brand-forest/10 text-brand-forest' : 'bg-brand-cream text-brand-taupe'
                      }`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-taupe">
                      Min order: ৳{c.min_order_amount} • Used {c.times_used} times
                      {c.max_discount_amount ? ` • Max cap: ৳${c.max_discount_amount}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCoupon(c.id, c.active)}
                      className="p-1 text-brand-taupe hover:text-brand-chocolate transition-colors"
                      title={c.active ? 'Deactivate' : 'Activate'}
                    >
                      {c.active ? <ToggleRight className="w-5 h-5 text-brand-forest" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(c.id, c.code)}
                      className="p-1 text-brand-taupe hover:text-brand-chocolate transition-colors"
                      title="Delete coupon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
