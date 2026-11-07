'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { 
  ShieldCheck, 
  MapPin, 
  Phone, 
  User, 
  Clock, 
  Copy, 
  Check, 
  AlertCircle,
  Truck,
  Sparkles,
  ChevronRight,
  Banknote,
  ArrowLeft,
  Tag,
  Gift,
  X
} from 'lucide-react';
import LoyaltyStampCard from '@/components/LoyaltyStampCard';
import { LoyaltyInfo } from '@/lib/types';

const POPULAR_RAJSHAHI_AREAS = [
  'Shaheb Bazar (সাহেব বাজার)',
  'Kazihata (কাজীহাতা)',
  'Upashahar (উপশহর)',
  'Talaimari (তালাইমারী)',
  'Motihar / RU Campus (মতিহার / রাবি ক্যাম্পাস)',
  'Padma Residential (পদ্মা আবাসিক)',
  'Laxmipur (লক্ষ্মীপুর)'
];

const ALL_RAJSHAHI_AREAS = [
  'Shaheb Bazar (সাহেব বাজার)',
  'Kazihata (কাজীহাতা)',
  'Upashahar (উপশহর)',
  'Talaimari (তালাইমারী)',
  'Motihar / RU Campus (মতিহার / রাবি ক্যাম্পাস)',
  'Padma Residential (পদ্মা আবাসিক)',
  'Laxmipur (লক্ষ্মীপুর)',
  'Bornali (বর্ণালী মোড়)',
  'Sagarpara (সাগরপাড়া)',
  'Shiroil (শিরোইল)',
  'Binodpur (বিনোদপুর)',
  'Court Area / Haragram (কোর্ট এলাকা / হড়গ্রাম)',
  'Chhotobonogram (ছোটবনগ্রাম)',
  'Vodra (ভদ্রা)',
  'Other Area in Rajshahi (অন্যান্য এলাকা)',
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, deliveryFee, clearCart } = useCart();
  const { lang, t } = useLanguage();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [areaLandmark, setAreaLandmark] = useState('');
  const [otherArea, setOtherArea] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash' | 'nagad'>('cod');
  const [trxId, setTrxId] = useState('');

  // Gift & Surprise Delivery state
  const [isGift, setIsGift] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [giftMessage, setGiftMessage] = useState('');

  // Promo Code / Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    message: string;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);

  const [idempotencyToken] = useState(() => `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Loyalty Rewards State
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);

  // Auto-lookup loyalty when phone number reaches 11 digits
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length >= 11) {
      fetch(`/api/loyalty?phone=${encodeURIComponent(digits)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.loyalty) {
            setLoyalty(data.loyalty);
            // Autofill name if customer hasn't typed one yet
            if (data.loyalty.customerName && !customerName) {
              setCustomerName(data.loyalty.customerName);
            }
          }
        })
        .catch(() => {});
    } else {
      setLoyalty(null);
    }
  }, [customerPhone]);

  // Calculate final total taking coupon discount into account
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const payableTotal = Math.max(0, subtotal - discountAmount) + deliveryFee;

  // Wallet payment options are only offered once settings have loaded and
  // the method is enabled with a real number configured. Until settings
  // load, all options stay visible so the page does not flash.
  const walletSettingsLoaded = shopSettings !== null;
  const bkashNumber = (shopSettings?.bkash_number || '').trim();
  const nagadNumber = (shopSettings?.nagad_number || '').trim();
  const codAvailable = !walletSettingsLoaded || shopSettings.cod_enabled !== false;
  const bkashAvailable = !walletSettingsLoaded || (shopSettings.bkash_enabled !== false && bkashNumber !== '');
  const nagadAvailable = !walletSettingsLoaded || (shopSettings.nagad_enabled !== false && nagadNumber !== '');

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setShopSettings(data.settings);
      })
      .catch(() => {});
  }, []);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) return;

    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The phone lets the server check loyalty-reward eligibility;
        // the order endpoint re-checks it authoritatively at checkout.
        body: JSON.stringify({ code, subtotal, phone: customerPhone || undefined }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.valid) {
        setAppliedCoupon({
          code: data.code,
          discountAmount: data.discountAmount,
          message: data.message,
        });
        setCouponInput('');
      } else {
        setCouponError(data.error || 'Invalid or expired coupon code.');
      }
    } catch {
      setCouponError('Failed to validate coupon. Please try again.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage(lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন।' : 'Please enter your name.');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 11 || (!cleanPhone.startsWith('01') && !cleanPhone.startsWith('8801'))) {
      setErrorMessage(
        lang === 'bn'
          ? 'অনুগ্রহ করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।'
          : 'Please enter a valid 11-digit Bangladesh phone number (e.g., 01712345678).'
      );
      return;
    }

    const finalArea = areaLandmark === 'Other Area in Rajshahi (অন্যান্য এলাকা)' ? otherArea.trim() : areaLandmark;
    if (!finalArea) {
      setErrorMessage(lang === 'bn' ? 'অনুগ্রহ করে রাজশাহীর ডেলিভারি এলাকা নির্বাচন করুন।' : 'Please select your Rajshahi area.');
      return;
    }

    if (!deliveryAddress.trim()) {
      setErrorMessage(lang === 'bn' ? 'অনুগ্রহ করে বিস্তারিত ঠিকানা লিখুন।' : 'Please enter your street / house address.');
      return;
    }

    if (isGift && !recipientName.trim()) {
      setErrorMessage(lang === 'bn' ? 'অনুগ্রহ করে উপহার প্রাপকের নাম লিখুন।' : 'Please enter the gift recipient’s name.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage(lang === 'bn' ? 'আপনার কার্ট খালি রয়েছে।' : 'Your cart is empty.');
      return;
    }

    // Never submit a wallet method that has no number configured.
    if (paymentMethod === 'bkash' && !bkashAvailable) {
      setErrorMessage(lang === 'bn' ? 'বিকাশ পেমেন্ট এখনো চালু হয়নি। অনুগ্রহ করে ক্যাশ অন ডেলিভারি বেছে নিন।' : 'bKash payment is not set up yet. Please choose Cash on Delivery.');
      return;
    }
    if (paymentMethod === 'nagad' && !nagadAvailable) {
      setErrorMessage(lang === 'bn' ? 'নগদ পেমেন্ট এখনো চালু হয়নি। অনুগ্রহ করে ক্যাশ অন ডেলিভারি বেছে নিন।' : 'Nagad payment is not set up yet. Please choose Cash on Delivery.');
      return;
    }
    if (paymentMethod === 'cod' && !codAvailable) {
      setErrorMessage(lang === 'bn' ? 'ক্যাশ অন ডেলিভারি এখন বন্ধ আছে। অনুগ্রহ করে অন্য পেমেন্ট পদ্ধতি বেছে নিন।' : 'Cash on Delivery is currently unavailable. Please choose another payment method.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryAddress,
          areaLandmark: finalArea,
          deliveryInstructions,
          requestedTime: requestedTime || undefined,
          paymentMethod,
          trxId: trxId.trim() || undefined,
          couponCode: appliedCoupon?.code || undefined,
          isGift,
          recipientName: isGift ? recipientName.trim() || undefined : undefined,
          recipientPhone: isGift ? recipientPhone.trim() || undefined : undefined,
          giftMessage: isGift ? giftMessage.trim() || undefined : undefined,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          idempotencyToken,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to place order. Please try again.');
        setIsSubmitting(false);
        return;
      }

      clearCart();
      const finalCode = data.publicCode || data.order?.publicCode;
      // Keep the phone in this browser session only, so the confirmation
      // page can verify the order without asking the customer again.
      try {
        sessionStorage.setItem('sc_order_phone', cleanPhone);
      } catch {}
      router.push(`/order/${finalCode}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred. Please check your connection.');
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-brand-cream-subtle flex items-center justify-center text-brand-caramel shadow-soft">
          <Truck className="w-10 h-10 stroke-[1.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold text-brand-chocolate">
            {lang === 'bn' ? 'আপনার মিষ্টির ব্যাগ খালি' : 'Your Dessert Bag is Empty'}
          </h1>
          <p className="text-sm text-brand-taupe max-w-sm mx-auto">
            {lang === 'bn'
              ? 'আমাদের টাটকা ঘরোয়া মেনু থেকে আপনার পছন্দের ডেজার্ট যোগ করুন।'
              : 'Explore our artisan handmade creations and treat yourself or your loved ones.'}
          </p>
        </div>
        <div>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 bg-brand-caramel hover:bg-brand-caramel-dark text-white font-bold py-3.5 px-8 rounded-full shadow-soft hover:shadow-soft-hover transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'bn' ? 'মেনু দেখুন' : 'Explore Fresh Sweets'}</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 space-y-8 font-sans">
      
      {/* Checkout Progress Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-cream-dark/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-caramel mb-1">
            <Link href="/menu" className="flex items-center gap-1 hover:underline text-brand-taupe">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'মেনুতে ফিরুন' : 'Back to Menu'}</span>
            </Link>
            <span>/</span>
            <span>{lang === 'bn' ? 'নিরাপদ চেকআউট' : 'Secure Checkout'}</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-brand-chocolate">
            {lang === 'bn' ? 'অর্ডার ফাইনাল করুন' : 'Complete Your Order'}
          </h1>
        </div>

        {/* 3 Step Pill Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-chocolate text-brand-gold-light font-semibold shadow-soft">
            <span className="w-4 h-4 rounded-full bg-brand-caramel text-white text-[10px] flex items-center justify-center font-bold">1</span>
            <span>{lang === 'bn' ? 'ঠিকানা' : 'Delivery'}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-brand-cream-dark" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-cream-subtle text-brand-chocolate font-semibold">
            <span className="w-4 h-4 rounded-full bg-brand-cream-dark text-brand-chocolate text-[10px] flex items-center justify-center font-bold">2</span>
            <span>{lang === 'bn' ? 'পেমেন্ট' : 'Payment'}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-brand-cream-dark" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-cream-subtle text-brand-taupe/60 font-medium">
            <span className="w-4 h-4 rounded-full bg-brand-cream-dark/60 text-brand-taupe text-[10px] flex items-center justify-center font-bold">3</span>
            <span>{lang === 'bn' ? 'কনফার্ম' : 'Bake'}</span>
          </div>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="bg-brand-strawberry-light border border-brand-strawberry/20 text-brand-strawberry p-4 rounded-2xl flex items-start gap-3 shadow-soft animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">{lang === 'bn' ? 'ত্রুটি' : 'Action Required'}</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form: Customer & Delivery Details */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Customer Info */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-brand-cream-dark shadow-soft space-y-5">
            <div className="flex items-center gap-2.5 border-b border-brand-cream-dark pb-3.5">
              <div className="w-7 h-7 rounded-full bg-brand-caramel-subtle text-brand-caramel flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('checkout.step1Title')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.nameLabel')} <span className="text-brand-strawberry">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t('checkout.namePlaceholder')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel focus:ring-2 focus:ring-brand-caramel-subtle text-sm text-brand-chocolate placeholder:text-brand-taupe/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.phoneLabel')} <span className="text-brand-strawberry">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t('checkout.phonePlaceholder')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel focus:ring-2 focus:ring-brand-caramel-subtle text-sm text-brand-chocolate placeholder:text-brand-taupe/50 transition-all"
                  />
                </div>
                <p className="text-[11px] text-brand-taupe mt-1">
                  {t('checkout.phoneHelp')}
                </p>
              </div>
            </div>

            {/* Loyalty Rewards Stamp Card */}
            {loyalty && (
              <div className="pt-2 animate-fade-in">
                <LoyaltyStampCard
                  loyalty={loyalty}
                  onApplyCoupon={(code) => handleApplyCoupon(code)}
                  isApplied={appliedCoupon?.code === 'SWEETREWARD'}
                />
              </div>
            )}
          </div>

          {/* Step 2: Rajshahi Delivery Details */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-brand-cream-dark shadow-soft space-y-5">
            <div className="flex items-center gap-2.5 border-b border-brand-cream-dark pb-3.5">
              <div className="w-7 h-7 rounded-full bg-brand-caramel-subtle text-brand-caramel flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('checkout.step2Title')}
              </h2>
            </div>

            <div className="space-y-4">
              
              {/* Popular area chips for 1-click select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.areaLabel')} <span className="text-brand-strawberry">*</span>
                </label>
                
                {/* Quick Area Pills */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {POPULAR_RAJSHAHI_AREAS.map((popArea) => {
                    const isSelected = areaLandmark === popArea;
                    const shortName = popArea.split(' (')[0];
                    return (
                      <button
                        key={popArea}
                        type="button"
                        onClick={() => setAreaLandmark(popArea)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-brand-caramel text-white border-brand-caramel font-semibold shadow-xs'
                            : 'bg-brand-cream-subtle/60 text-brand-chocolate hover:bg-brand-cream border-brand-cream-dark'
                        }`}
                      >
                        {shortName}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
                  <select
                    required
                    value={areaLandmark}
                    onChange={(e) => setAreaLandmark(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate transition-all appearance-none cursor-pointer"
                  >
                    <option value="">{t('checkout.areaSelectDefault')}</option>
                    {ALL_RAJSHAHI_AREAS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              {areaLandmark === 'Other Area in Rajshahi (অন্যান্য এলাকা)' && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                    {lang === 'bn' ? 'এলাকার নাম লিখুন' : 'Specify Rajshahi Area'} <span className="text-brand-strawberry">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={otherArea}
                    onChange={(e) => setOtherArea(e.target.value)}
                    placeholder={t('checkout.otherAreaPlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.addressLabel')} <span className="text-brand-strawberry">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t('checkout.addressPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate placeholder:text-brand-taupe/50 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                    {t('checkout.instructionsLabel')}
                  </label>
                  <input
                    type="text"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder={t('checkout.instructionsPlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate placeholder:text-brand-taupe/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                    {t('checkout.timeLabel')}
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
                    <input
                      type="text"
                      value={requestedTime}
                      onChange={(e) => setRequestedTime(e.target.value)}
                      placeholder={t('checkout.timePlaceholder')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate placeholder:text-brand-taupe/50"
                    />
                  </div>
                  <p className="text-[10px] text-brand-taupe mt-1">
                    {t('checkout.timeHelp')}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Optional Gift & Surprise Delivery Module */}
          <div className="bg-gradient-to-br from-white to-[#FDF9F5] p-5 sm:p-7 rounded-3xl border border-brand-cream-dark/90 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="gift-toggle"
                className="flex items-center gap-3 cursor-pointer select-none"
              >
                <div className="w-9 h-9 rounded-full bg-brand-caramel-subtle text-brand-caramel flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-heading font-semibold text-sm sm:text-base text-brand-chocolate block">
                    {lang === 'bn' ? 'কাউকে উপহার বা সারপ্রাইজ পাঠাচ্ছেন?' : 'Sending as a Gift or Surprise?'}
                  </span>
                  <span className="text-xs text-brand-taupe block">
                    {lang === 'bn' 
                      ? 'বিনামূল্যে সুন্দর ফিতা ও হাতে লেখা শুভেচ্ছা কার্ড যুক্ত করুন' 
                      : 'Complimentary silk ribbon & handwritten note card included'}
                  </span>
                </div>
              </label>

              {/* Toggle switch */}
              <input
                id="gift-toggle"
                type="checkbox"
                checked={isGift}
                onChange={(e) => setIsGift(e.target.checked)}
                className="w-5 h-5 accent-brand-caramel cursor-pointer"
              />
            </div>

            {isGift && (
              <div className="pt-3 border-t border-brand-cream-dark/60 space-y-3.5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-brand-chocolate/80 mb-1">
                      {lang === 'bn' ? 'প্রাপকের নাম' : 'Recipient Name'}
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: আয়েশা সিদ্দিকা' : 'e.g. Ayesha Siddika'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-brand-cream-dark bg-white focus:outline-none focus:border-brand-caramel text-xs sm:text-sm text-brand-chocolate"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-brand-chocolate/80 mb-1">
                      {lang === 'bn' ? 'প্রাপকের ফোন নম্বর' : 'Recipient Phone (Optional)'}
                    </label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder={lang === 'bn' ? '01XXXXXXXXX' : '01XXXXXXXXX'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-brand-cream-dark bg-white focus:outline-none focus:border-brand-caramel text-xs sm:text-sm text-brand-chocolate"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-chocolate/80 mb-1 flex items-center justify-between">
                    <span>{lang === 'bn' ? 'হাতে লেখা শুভেচ্ছা বার্তা' : 'Handwritten Card Message'}</span>
                    <span className="text-[10px] text-brand-taupe font-normal">
                      {giftMessage.length}/150
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    maxLength={150}
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder={lang === 'bn' 
                      ? 'যেমন: শুভ জন্মদিন প্রিয় বন্ধু! জীবনের প্রতিটি দিন মিষ্টি হোক...' 
                      : 'e.g. Happy Birthday! Wishing you a sweet day filled with joy & delicious treats...'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-cream-dark bg-white focus:outline-none focus:border-brand-caramel text-xs sm:text-sm text-brand-chocolate resize-none"
                  />
                  <p className="text-[10px] text-brand-caramel flex items-center gap-1 mt-1">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>
                      {lang === 'bn' 
                        ? 'আমাদের হোম বেকারি আপু নিজ হাতে সুন্দর কার্ডে বার্তাটি লিখে বক্সে যুক্ত করবেন।' 
                        : 'Our bakery sister will handwrite your message on a bespoke luxury card.'}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Payment Method with Elevated Branded Cards */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-brand-cream-dark shadow-soft space-y-5">
            <div className="flex items-center gap-2.5 border-b border-brand-cream-dark pb-3.5">
              <div className="w-7 h-7 rounded-full bg-brand-caramel-subtle text-brand-caramel flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('checkout.step4Title')}
              </h2>
            </div>

            <div className="space-y-3">
              
              {/* Option 1: COD */}
              {codAvailable && (
              <label
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-brand-caramel bg-brand-caramel-subtle/30 shadow-soft ring-1 ring-brand-caramel/20'
                    : 'border-brand-cream-dark hover:border-brand-caramel/40 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="w-4 h-4 text-brand-caramel focus:ring-brand-caramel cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-brand-chocolate flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-brand-caramel" />
                      {t('checkout.codLabel')}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-cream-subtle px-2 py-0.5 rounded text-brand-taupe">
                      {lang === 'bn' ? 'জনপ্রিয়' : 'Standard'}
                    </span>
                  </div>
                  <p className="text-xs text-brand-taupe mt-1">
                    {t('checkout.codDesc')}
                  </p>
                </div>
              </label>
              )}

              {/* Option 2: bKash */}
              {bkashAvailable && (
              <label
                onClick={() => setPaymentMethod('bkash')}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'bkash'
                    ? 'border-[#E2136E] bg-[#FFF5F8] shadow-soft ring-1 ring-[#E2136E]/20'
                    : 'border-brand-cream-dark hover:border-[#E2136E]/40 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'bkash'}
                    onChange={() => setPaymentMethod('bkash')}
                    className="w-4 h-4 text-[#E2136E] focus:ring-[#E2136E] cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#8C1347] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] inline-block" />
                      {t('checkout.bkashLabel')}
                    </span>
                    <span className="text-[10px] font-bold tracking-wider bg-[#E2136E]/10 text-[#E2136E] px-2 py-0.5 rounded-full">
                      Send Money
                    </span>
                  </div>
                  <p className="text-xs text-brand-taupe mt-1">
                    {t('checkout.bkashDesc')}
                  </p>
                </div>
              </label>
              )}

              {/* bKash Details Expandable Box */}
              {paymentMethod === 'bkash' && (
                <div className="bg-[#FFF8FA] border border-[#E2136E]/20 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn text-xs text-brand-chocolate ml-2">
                  <div className="flex items-center justify-between border-b border-[#E2136E]/15 pb-2.5">
                    <div className="flex items-center gap-1.5 text-[#8C1347] font-bold text-xs uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[#E2136E]" />
                      <span>Sweet Cravings bKash Wallet</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { if (bkashNumber) handleCopy(bkashNumber, 'bkash'); }}
                      disabled={!bkashNumber}
                      className="flex items-center gap-1.5 text-xs bg-white border border-[#E2136E]/30 text-[#8C1347] px-3 py-1 rounded-full font-bold shadow-xs hover:bg-[#FFEBF1] transition-colors"
                    >
                      {copiedKey === 'bkash' ? <Check className="w-3 h-3 text-brand-forest" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'bkash' ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy Number')}</span>
                    </button>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#E2136E]/15 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-lg font-extrabold text-brand-chocolate tracking-wide">
                        {bkashNumber || (lang === 'bn' ? 'নম্বর এখনো দেওয়া হয়নি' : 'Number not set yet')}
                      </p>
                      <p className="text-[11px] text-brand-taupe">
                        Type: <span className="font-semibold text-brand-chocolate capitalize">{shopSettings?.bkash_type || 'Personal'}</span> (Send Money)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-brand-taupe uppercase block">Pay Exact</span>
                      <span className="font-heading font-extrabold text-[#8C1347] text-base">৳{payableTotal}</span>
                    </div>
                  </div>

                  {/* Step Instructions */}
                  <div className="space-y-1.5 text-brand-taupe text-[11px] leading-relaxed bg-white/70 p-3 rounded-xl border border-[#E2136E]/10">
                    <p className="font-bold text-brand-chocolate mb-1">
                      {lang === 'bn' ? 'পেমেন্ট নির্দেশিকা:' : 'Payment Instructions:'}
                    </p>
                    <p>1. bKash অ্যাপ ওপেন করে <strong>Send Money</strong> অপশন নির্বাচন করুন।</p>
                    <p>2. প্রাপক নম্বরে উপরের নম্বরটি দিয়ে মোট <strong>৳{payableTotal}</strong> সেন্ড করুন।</p>
                    <p>3. পেমেন্ট সম্পন্ন হলে প্রাপ্ত <strong>TrxID (Transaction ID)</strong> নিচের বক্সে দিন (অথবা অর্ডারের পর আমাদের হোয়াটসঅ্যাপেও পাঠাতে পারেন)।</p>
                  </div>

                  <div>
                    <label className="block font-bold text-xs text-brand-chocolate mb-1.5">
                      {t('checkout.walletTrxOptional')}
                    </label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder={t('checkout.walletTrxPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E2136E]/30 bg-white text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-[#E2136E] focus:ring-2 focus:ring-[#E2136E]/20"
                    />
                  </div>
                </div>
              )}

              {/* Option 3: Nagad */}
              {nagadAvailable && (
              <label
                onClick={() => setPaymentMethod('nagad')}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'nagad'
                    ? 'border-[#F7941D] bg-[#FFF9F2] shadow-soft ring-1 ring-[#F7941D]/20'
                    : 'border-brand-cream-dark hover:border-[#F7941D]/40 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'nagad'}
                    onChange={() => setPaymentMethod('nagad')}
                    className="w-4 h-4 text-[#F7941D] focus:ring-[#F7941D] cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#A35200] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F7941D] inline-block" />
                      {t('checkout.nagadLabel')}
                    </span>
                    <span className="text-[10px] font-bold tracking-wider bg-[#F7941D]/10 text-[#F7941D] px-2 py-0.5 rounded-full">
                      Send Money
                    </span>
                  </div>
                  <p className="text-xs text-brand-taupe mt-1">
                    {t('checkout.nagadDesc')}
                  </p>
                </div>
              </label>
              )}

              {/* Nagad Details Expandable Box */}
              {paymentMethod === 'nagad' && (
                <div className="bg-[#FFFBF5] border border-[#F7941D]/20 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn text-xs text-brand-chocolate ml-2">
                  <div className="flex items-center justify-between border-b border-[#F7941D]/15 pb-2.5">
                    <div className="flex items-center gap-1.5 text-[#A35200] font-bold text-xs uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[#F7941D]" />
                      <span>Sweet Cravings Nagad Wallet</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { if (nagadNumber) handleCopy(nagadNumber, 'nagad'); }}
                      disabled={!nagadNumber}
                      className="flex items-center gap-1.5 text-xs bg-white border border-[#F7941D]/30 text-[#A35200] px-3 py-1 rounded-full font-bold shadow-xs hover:bg-[#FFF3E3] transition-colors"
                    >
                      {copiedKey === 'nagad' ? <Check className="w-3 h-3 text-brand-forest" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'nagad' ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy Number')}</span>
                    </button>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#F7941D]/15 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-lg font-extrabold text-brand-chocolate tracking-wide">
                        {nagadNumber || (lang === 'bn' ? 'নম্বর এখনো দেওয়া হয়নি' : 'Number not set yet')}
                      </p>
                      <p className="text-[11px] text-brand-taupe">
                        Type: <span className="font-semibold text-brand-chocolate capitalize">{shopSettings?.nagad_type || 'Personal'}</span> (Send Money)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-brand-taupe uppercase block">Pay Exact</span>
                      <span className="font-heading font-extrabold text-[#A35200] text-base">৳{payableTotal}</span>
                    </div>
                  </div>

                  {/* Step Instructions */}
                  <div className="space-y-1.5 text-brand-taupe text-[11px] leading-relaxed bg-white/70 p-3 rounded-xl border border-[#F7941D]/10">
                    <p className="font-bold text-brand-chocolate mb-1">
                      {lang === 'bn' ? 'পেমেন্ট নির্দেশিকা:' : 'Payment Instructions:'}
                    </p>
                    <p>1. Nagad অ্যাপ ওপেন করে <strong>Send Money</strong> অপশন নির্বাচন করুন।</p>
                    <p>2. প্রাপক নম্বরে উপরের নম্বরটি দিয়ে মোট <strong>৳{payableTotal}</strong> সেন্ড করুন।</p>
                    <p>3. পেমেন্ট সম্পন্ন হলে প্রাপ্ত <strong>TrxID</strong> নিচের বক্সে দিন।</p>
                  </div>

                  <div>
                    <label className="block font-bold text-xs text-brand-chocolate mb-1.5">
                      {t('checkout.walletTrxOptional')}
                    </label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      placeholder={t('checkout.walletTrxPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#F7941D]/30 bg-white text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-[#F7941D] focus:ring-2 focus:ring-[#F7941D]/20"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Right Sticky Column: Order Summary & Review */}
        <div className="lg:col-span-5">
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-brand-cream-dark shadow-soft space-y-6 sticky top-28">
            
            <div className="border-b border-brand-cream-dark pb-3.5 flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('checkout.orderSummary')}
              </h2>
              <span className="text-xs bg-brand-cream-subtle px-2.5 py-0.5 rounded-full text-brand-taupe font-semibold">
                {items.reduce((s, i) => s + i.quantity, 0)} {lang === 'bn' ? 'আইটেম' : 'items'}
              </span>
            </div>

            {/* Cart item breakdown */}
            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center text-xs">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-brand-cream-subtle shrink-0 border border-brand-cream-dark">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name_en}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-caramel">
                        <Sparkles className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-brand-chocolate truncate">
                      {lang === 'bn' ? item.name_bn : item.name_en}
                    </p>
                    <p className="text-brand-taupe text-[11px] mt-0.5">
                      {item.quantity} × ৳{item.unitPrice}
                      {(item.variantLabel_en || item.variantLabel_bn) && (
                        <span> • {lang === 'bn' ? item.variantLabel_bn : item.variantLabel_en}</span>
                      )}
                    </p>
                  </div>
                  <span className="font-bold text-brand-chocolate text-sm">৳{item.lineTotal}</span>
                </div>
              ))}
            </div>

            {/* Promo / Coupon Code Section */}
            <div className="border-t border-brand-cream-dark pt-3.5 space-y-2">
              <label className="block text-xs font-bold text-brand-chocolate flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-caramel" />
                  <span>{lang === 'bn' ? 'প্রোমো কোড / কুপন' : 'Have a Promo Code?'}</span>
                </span>
                {!appliedCoupon && (
                  <span className="text-[10px] text-brand-taupe font-normal">
                    Try: <button type="button" onClick={() => handleApplyCoupon('WELCOME50')} className="font-mono font-bold text-brand-caramel underline">WELCOME50</button>
                  </span>
                )}
              </label>

              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-brand-forest-light border border-brand-forest/20 text-brand-forest px-3.5 py-2.5 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-forest" />
                    <div>
                      <span className="font-mono font-bold tracking-wider">{appliedCoupon.code}</span>
                      <span className="text-brand-taupe text-[11px] block">Saved ৳{appliedCoupon.discountAmount} on this order</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1 hover:bg-brand-forest/10 rounded-full transition-colors"
                    title="Remove coupon"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder={lang === 'bn' ? 'কুপন কোড লিখুন' : 'Enter coupon code'}
                      className="flex-1 px-3 py-2 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/50 text-xs font-mono uppercase tracking-wider focus:bg-white focus:outline-none focus:border-brand-caramel"
                    />
                    <button
                      type="button"
                      disabled={isValidatingCoupon || !couponInput.trim()}
                      onClick={() => handleApplyCoupon()}
                      className="bg-brand-chocolate hover:bg-brand-chocolate-light text-brand-gold-light px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {isValidatingCoupon ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-brand-strawberry animate-fadeIn flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{couponError}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-brand-cream-dark pt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-brand-taupe text-xs sm:text-sm">
                <span>{t('cart.subtotal')}</span>
                <span className="font-semibold text-brand-chocolate">৳{subtotal}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-brand-forest text-xs sm:text-sm animate-fadeIn">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Coupon ({appliedCoupon?.code})</span>
                  </span>
                  <span className="font-bold">-৳{discountAmount}</span>
                </div>
              )}

              <div className="flex justify-between text-brand-taupe text-xs sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-brand-caramel" />
                  <span>{t('cart.deliveryFee')}</span>
                </span>
                <span className="font-semibold">
                  {deliveryFee === 0 ? (
                    <span className="text-brand-forest font-bold bg-brand-forest-light px-2 py-0.5 rounded text-xs">
                      {lang === 'bn' ? 'ফ্রি ডেলিভারি' : 'FREE'}
                    </span>
                  ) : (
                    `৳${deliveryFee}`
                  )}
                </span>
              </div>

              <div className="border-t border-brand-cream-dark pt-3 flex justify-between font-heading text-lg font-bold text-brand-chocolate items-baseline">
                <div>
                  <span>{t('cart.total')}</span>
                  <span className="text-[10px] text-brand-taupe block font-normal font-sans">
                    {lang === 'bn' ? 'সকল চার্জ অন্তর্ভুক্ত' : 'Includes all local taxes'}
                  </span>
                </div>
                <span className="text-brand-caramel font-extrabold text-2xl">৳{payableTotal}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-sm shadow-soft transition-all flex items-center justify-center gap-2 btn-press ${
                isSubmitting
                  ? 'bg-brand-cream-dark text-brand-taupe cursor-wait'
                  : 'bg-brand-caramel hover:bg-brand-caramel-hover text-white hover:shadow-card'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('checkout.placingOrder')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t('checkout.placeOrder')} (৳{payableTotal})</span>
                </>
              )}
            </button>

            {/* Security Guarantee */}
            <div className="space-y-2 text-[11px] text-brand-taupe text-center pt-1 border-t border-brand-cream-dark">
              <p className="flex items-center justify-center gap-1.5 text-brand-chocolate/80 font-medium">
                <ShieldCheck className="w-4 h-4 text-brand-forest shrink-0" />
                <span>{lang === 'bn' ? 'নিরাপদ ঘরোয়া অর্ডার • তাজা বেকিং গ্যারান্টি' : 'Safe Guest Order • Fresh Baking Guarantee'}</span>
              </p>
              <p className="text-[10px]">
                {lang === 'bn' 
                  ? 'রাজশাহীর নিজস্ব কিচেন থেকে প্রতিটি অর্ডার গ্রহণ করার পর তৈরি করা হয়।' 
                  : 'Every batch is prepared fresh upon confirmation in our Rajshahi kitchen.'}
              </p>
            </div>

          </div>
        </div>

      </form>
    </div>
  );
}
