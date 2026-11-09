'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
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
  X,
  MessageCircle
} from 'lucide-react';
import LoyaltyStampCard from '@/components/LoyaltyStampCard';
import { PublicLoyaltyInfo } from '@/lib/types';
import { toWhatsAppDigits } from '@/lib/phone';

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
  // The bKash/Nagad number the customer paid FROM (captured next to the
  // TrxID, so the admin can verify the payment in the wallet app).
  const [senderNumber, setSenderNumber] = useState('');
  const [senderError, setSenderError] = useState<string | null>(null);

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
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // True when the server refused the order for the daily per-phone cap:
  // the error banner then offers a WhatsApp chat with the shop instead
  // of leaving a real customer stranded.
  const [orderLimitReached, setOrderLimitReached] = useState(false);
  const [trxError, setTrxError] = useState<string | null>(null);
  // True once the saved checkout form (if any) has been restored.
  const [formHydrated, setFormHydrated] = useState(false);
  // Shop settings come from the shared catalogue (fetched once per page
  // load); null until it arrives, same as before.
  const { settings: shopSettings } = useCatalog();

  // WhatsApp fallback for the daily order cap (see orderLimitReached):
  // the shop's number, normalized to wa.me form. Empty until settings
  // load or the shop has no WhatsApp number configured — then the
  // button is hidden and only the message shows.
  const limitWaDigits = toWhatsAppDigits(shopSettings?.whatsapp_number || '');
  const limitWaUrl = limitWaDigits
    ? `https://wa.me/${limitWaDigits}?text=${encodeURIComponent("Salam Sweet Cravings! I've reached today's online order limit and would like to place another order.")}`
    : '';

  const [idempotencyToken] = useState(() => `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Loyalty Rewards State
  const [loyalty, setLoyalty] = useState<PublicLoyaltyInfo | null>(null);

  // Auto-lookup loyalty when phone number reaches 11 digits
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length >= 11) {
      fetch(`/api/loyalty?phone=${encodeURIComponent(digits)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.loyalty) {
            setLoyalty(data.loyalty);
          }
        })
        .catch(() => {});
    } else {
      setLoyalty(null);
    }
  }, [customerPhone]);

  // Keep the checkout form safe across a refresh: the customer has to
  // leave this tab to pay in the bKash/Nagad app, and a refresh or a
  // closed tab must not lose what they typed. Restored once on load,
  // saved on every change, cleared after a successful submit or draft
  // save. The applied coupon is NOT restored (it is re-validated live).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sc_checkout_form_v1');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (typeof saved.customerName === 'string') setCustomerName(saved.customerName);
          if (typeof saved.customerPhone === 'string') setCustomerPhone(saved.customerPhone);
          if (typeof saved.areaLandmark === 'string') setAreaLandmark(saved.areaLandmark);
          if (typeof saved.otherArea === 'string') setOtherArea(saved.otherArea);
          if (typeof saved.deliveryAddress === 'string') setDeliveryAddress(saved.deliveryAddress);
          if (typeof saved.deliveryInstructions === 'string') setDeliveryInstructions(saved.deliveryInstructions);
          if (typeof saved.requestedTime === 'string') setRequestedTime(saved.requestedTime);
          if (saved.paymentMethod === 'cod' || saved.paymentMethod === 'bkash' || saved.paymentMethod === 'nagad') setPaymentMethod(saved.paymentMethod);
          if (typeof saved.trxId === 'string') setTrxId(saved.trxId);
          if (typeof saved.isGift === 'boolean') setIsGift(saved.isGift);
          if (typeof saved.recipientName === 'string') setRecipientName(saved.recipientName);
          if (typeof saved.recipientPhone === 'string') setRecipientPhone(saved.recipientPhone);
          if (typeof saved.giftMessage === 'string') setGiftMessage(saved.giftMessage);
        }
      }
    } catch {}
    setFormHydrated(true);
  }, []);

  useEffect(() => {
    if (!formHydrated) return;
    try {
      localStorage.setItem('sc_checkout_form_v1', JSON.stringify({
        customerName, customerPhone, areaLandmark, otherArea, deliveryAddress,
        deliveryInstructions, requestedTime, paymentMethod, trxId,
        isGift, recipientName, recipientPhone, giftMessage,
      }));
    } catch {}
  }, [formHydrated, customerName, customerPhone, areaLandmark, otherArea, deliveryAddress, deliveryInstructions, requestedTime, paymentMethod, trxId, isGift, recipientName, recipientPhone, giftMessage]);

  const clearSavedForm = () => {
    try {
      localStorage.removeItem('sc_checkout_form_v1');
    } catch {}
  };

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

  // Derived from the form, shared by both checkout paths.
  const cleanPhone = customerPhone.replace(/\D/g, '');
  const finalArea = areaLandmark === 'Other Area in Rajshahi (অন্যান্য এলাকা)' ? otherArea.trim() : areaLandmark;

  // Shared field validation for both checkout paths (submit + save).
  // Returns the error message, or null when the form is valid. The
  // TrxID check is NOT here: only the submit path requires it.
  const validateCheckoutFields = (): string | null => {
    if (!customerName.trim()) {
      return lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন।' : 'Please enter your name.';
    }
    if (cleanPhone.length < 11 || (!cleanPhone.startsWith('01') && !cleanPhone.startsWith('8801'))) {
      return lang === 'bn'
        ? 'অনুগ্রহ করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।'
        : 'Please enter a valid 11-digit Bangladesh phone number (e.g., 01712345678).';
    }
    if (!finalArea) {
      return lang === 'bn' ? 'অনুগ্রহ করে রাজশাহীর ডেলিভারি এলাকা নির্বাচন করুন।' : 'Please select your Rajshahi area.';
    }
    if (!deliveryAddress.trim()) {
      return lang === 'bn' ? 'অনুগ্রহ করে বিস্তারিত ঠিকানা লিখুন।' : 'Please enter your street / house address.';
    }
    if (isGift && !recipientName.trim()) {
      return lang === 'bn' ? 'অনুগ্রহ করে উপহার প্রাপকের নাম লিখুন।' : 'Please enter the gift recipient’s name.';
    }
    if (items.length === 0) {
      return lang === 'bn' ? 'আপনার কার্ট খালি রয়েছে।' : 'Your cart is empty.';
    }
    // Never submit a wallet method that has no number configured.
    if (paymentMethod === 'bkash' && !bkashAvailable) {
      return lang === 'bn' ? 'বিকাশ পেমেন্ট এখনো চালু হয়নি। অনুগ্রহ করে ক্যাশ অন ডেলিভারি বেছে নিন।' : 'bKash payment is not set up yet. Please choose Cash on Delivery.';
    }
    if (paymentMethod === 'nagad' && !nagadAvailable) {
      return lang === 'bn' ? 'নগদ পেমেন্ট এখনো চালু হয়নি। অনুগ্রহ করে ক্যাশ অন ডেলিভারি বেছে নিন।' : 'Nagad payment is not set up yet. Please choose Cash on Delivery.';
    }
    if (paymentMethod === 'cod' && !codAvailable) {
      return lang === 'bn' ? 'ক্যাশ অন ডেলিভারি এখন বন্ধ আছে। অনুগ্রহ করে অন্য পেমেন্ট পদ্ধতি বেছে নিন।' : 'Cash on Delivery is currently unavailable. Please choose another payment method.';
    }
    return null;
  };

  // Both checkout paths go through here.
  // - submit (saveAsDraft false): TrxID required, creates a submitted order.
  // - save draft (saveAsDraft true): no TrxID needed, creates a saved
  //   order the customer finishes later with the TrxID. Only offered
  //   for bKash/Nagad; the server rejects a COD draft.
  const placeOrder = async (saveAsDraft: boolean) => {
    setErrorMessage(null);
    setTrxError(null);
    setSenderError(null);
    setOrderLimitReached(false);

    const fieldError = validateCheckoutFields();
    if (fieldError) {
      setErrorMessage(fieldError);
      return;
    }

    // bKash/Nagad orders cannot be placed without a TrxID: the customer
    // pays first, then enters the TrxID they received. COD needs none.
    // A draft skips this: it carries no TrxID by design.
    if (!saveAsDraft && (paymentMethod === 'bkash' || paymentMethod === 'nagad') && !trxId.trim()) {
      const msg = lang === 'bn'
        ? (paymentMethod === 'bkash'
          ? 'বিকাশে পেমেন্ট পাঠানোর পর প্রাপ্ত TrxID-টি অবশ্যই দিন। TrxID ছাড়া অর্ডার নেওয়া হবে না।'
          : 'নগদে পেমেন্ট পাঠানোর পর প্রাপ্ত TrxID-টি অবশ্যই দিন। TrxID ছাড়া অর্ডার নেওয়া হবে না।')
        : `Please enter the TrxID you received after sending the ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} payment. Your order cannot be placed without it.`;
      setErrorMessage(msg);
      setTrxError(msg);
      return;
    }

    // The sender number is required together with the TrxID: the admin
    // checks the wallet app for a transaction FROM this number. Same
    // rule as the server — 11 digits starting with 01 (spaces/dashes
    // and a leading 88 are stripped). A draft skips this too.
    if (!saveAsDraft && (paymentMethod === 'bkash' || paymentMethod === 'nagad')) {
      const senderDigits = senderNumber.replace(/\D/g, '');
      const senderNorm = senderDigits.startsWith('88') && senderDigits.length === 13 ? senderDigits.slice(2) : senderDigits;
      if (!/^01\d{9}$/.test(senderNorm)) {
        const msg = t('checkout.senderNumberInvalid');
        setErrorMessage(msg);
        setSenderError(msg);
        return;
      }
    }

    if (saveAsDraft) setIsSavingDraft(true);
    else setIsSubmitting(true);

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
          trxId: saveAsDraft ? undefined : (trxId.trim() || undefined),
          senderNumber: saveAsDraft ? undefined : (senderNumber.trim() || undefined),
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
          saveAsDraft: saveAsDraft || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // A missing/invalid sender number: show it at the sender field
        // as well as the top error, so the customer can correct it and
        // retry — the form is kept, nothing is lost.
        if (data.code === 'INVALID_SENDER_NUMBER') {
          const msg = t('checkout.senderNumberInvalid');
          setErrorMessage(msg);
          setSenderError(msg);
        } else if (data.code === 'DUPLICATE_TRXID') {
          const msg = lang === 'bn'
            ? 'এই TrxID-টি ইতিমধ্যে ব্যবহার করা হয়েছে। TrxID-টি যাচাই করে আবার চেষ্টা করুন।'
            : (data.error || 'This TrxID has already been used. Please check the TrxID and try again.');
          setErrorMessage(msg);
          setTrxError(msg);
        } else if (data.code === 'ORDER_LIMIT_REACHED') {
          // Daily per-phone cap: the form is kept, and the banner below
          // offers a WhatsApp chat with the shop so a real customer can
          // still place the order manually.
          const msg = lang === 'bn'
            ? 'এই নম্বরে আজকের অনলাইন অর্ডারের সীমা শেষ হয়ে গেছে। WhatsApp-এ মেসেজ করুন, আমরা আপনার অর্ডারটি নিজে নিয়ে নেব।'
            : (data.error || 'You have reached today\'s online order limit for this phone number. Message us on WhatsApp and we will take your order manually.');
          setErrorMessage(msg);
          setOrderLimitReached(true);
        } else {
          setErrorMessage(data.error || 'Failed to place order. Please try again.');
        }
        if (saveAsDraft) setIsSavingDraft(false);
        else setIsSubmitting(false);
        return;
      }

      clearSavedForm();
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
      if (saveAsDraft) setIsSavingDraft(false);
      else setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await placeOrder(false);
  };

  const handleSaveDraft = async () => {
    await placeOrder(true);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-brand-cream flex items-center justify-center text-brand-caramel shadow-soft">
          <Truck className="w-10 h-10 stroke-[1.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-[32px] sm:text-[40px] font-bold text-brand-chocolate leading-[1.15]">
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
            className="inline-flex items-center gap-2 bg-brand-chocolate hover:bg-brand-chocolate text-white font-bold py-3.5 px-8 rounded-full shadow-soft hover:shadow-soft-hover transition-all"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DFD6] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-caramel mb-1">
            <Link href="/menu" className="flex items-center gap-1 hover:underline text-brand-taupe">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'মেনুতে ফিরুন' : 'Back to Menu'}</span>
            </Link>
            <span>/</span>
            <span>{lang === 'bn' ? 'নিরাপদ চেকআউট' : 'Secure Checkout'}</span>
          </div>
          <h1 className="font-heading text-[32px] sm:text-[40px] font-bold text-brand-chocolate leading-[1.15]">
            {lang === 'bn' ? 'অর্ডার ফাইনাল করুন' : 'Complete Your Order'}
          </h1>
        </div>

        {/* 3 Step Pill Indicator */}
        <div className="flex items-center gap-2 text-[13px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-chocolate text-brand-cream font-semibold shadow-soft">
            <span className="w-4 h-4 rounded-full bg-brand-chocolate text-white text-[13px] flex items-center justify-center font-bold">1</span>
            <span>{lang === 'bn' ? 'ঠিকানা' : 'Delivery'}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-brand-cream" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-cream text-brand-chocolate font-semibold">
            <span className="w-4 h-4 rounded-full bg-brand-chocolate/5 text-brand-chocolate text-[13px] flex items-center justify-center font-bold">2</span>
            <span>{lang === 'bn' ? 'পেমেন্ট' : 'Payment'}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-brand-cream" />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-cream text-brand-taupe/60 font-medium">
            <span className="w-4 h-4 rounded-full bg-brand-chocolate/5 text-brand-taupe text-[13px] flex items-center justify-center font-bold">3</span>
            <span>{lang === 'bn' ? 'কনফার্ম' : 'Bake'}</span>
          </div>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="bg-brand-caramel/10 border border-brand-chocolate/20 text-brand-chocolate p-4 rounded-2xl flex items-start gap-3 shadow-soft animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm min-w-0">
            <p className="font-bold">{lang === 'bn' ? 'ত্রুটি' : 'Action Required'}</p>
            <p>{errorMessage}</p>
            {orderLimitReached && limitWaUrl && (
              <a
                href={limitWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 bg-[#25D366] hover:brightness-95 text-white font-bold px-4 py-2 rounded-xl text-[13px] shadow-soft transition-all"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>{lang === 'bn' ? 'WhatsApp-এ অর্ডার করুন' : 'Order on WhatsApp'}</span>
              </a>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form: Customer & Delivery Details */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Customer Info */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-[#E7DFD6] shadow-soft space-y-5">
            <div className="flex items-center gap-2.5 border-b border-[#E7DFD6] pb-3.5">
              <div className="w-7 h-7 rounded-full bg-brand-caramel/10 text-brand-caramel flex items-center justify-center font-bold text-[13px]">
                1
              </div>
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('checkout.step1Title')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.nameLabel')} <span className="text-brand-chocolate">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t('checkout.namePlaceholder')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel focus:ring-2 focus:ring-brand-caramel/10 text-sm text-brand-chocolate placeholder:text-brand-taupe/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.phoneLabel')} <span className="text-brand-chocolate">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t('checkout.phonePlaceholder')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel focus:ring-2 focus:ring-brand-caramel/10 text-sm text-brand-chocolate placeholder:text-brand-taupe/50 transition-all"
                  />
                </div>
                <p className="text-[13px] text-brand-taupe mt-1">
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
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-[#E7DFD6] shadow-soft space-y-5">
            <div className="flex items-center gap-2.5 border-b border-[#E7DFD6] pb-3.5">
              <div className="w-7 h-7 rounded-full bg-brand-caramel/10 text-brand-caramel flex items-center justify-center font-bold text-[13px]">
                2
              </div>
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('checkout.step2Title')}
              </h2>
            </div>

            <div className="space-y-4">
              
              {/* Popular area chips for 1-click select */}
              <div>
                <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.areaLabel')} <span className="text-brand-chocolate">*</span>
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
                        className={`text-[13px] px-2.5 py-1 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-brand-chocolate text-white border-brand-caramel font-semibold shadow-xs'
                            : 'bg-brand-cream/60 text-brand-chocolate hover:bg-brand-cream border-[#E7DFD6]'
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate transition-all appearance-none cursor-pointer"
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
                  <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                    {lang === 'bn' ? 'এলাকার নাম লিখুন' : 'Specify Rajshahi Area'} <span className="text-brand-chocolate">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={otherArea}
                    onChange={(e) => setOtherArea(e.target.value)}
                    placeholder={t('checkout.otherAreaPlaceholder')}
                    className="w-full px-4 py-3 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate"
                  />
                </div>
              )}

              <div>
                <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                  {t('checkout.addressLabel')} <span className="text-brand-chocolate">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t('checkout.addressPlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate placeholder:text-brand-taupe/50 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                    {t('checkout.instructionsLabel')}
                  </label>
                  <input
                    type="text"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder={t('checkout.instructionsPlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate placeholder:text-brand-taupe/50"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                    {t('checkout.timeLabel')}
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
                    <input
                      type="text"
                      value={requestedTime}
                      onChange={(e) => setRequestedTime(e.target.value)}
                      placeholder={t('checkout.timePlaceholder')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate placeholder:text-brand-taupe/50"
                    />
                  </div>
                  <p className="text-[13px] text-brand-taupe mt-1">
                    {t('checkout.timeHelp')}
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Optional Gift & Surprise Delivery Module */}
          <div className="bg-gradient-to-br from-white to-[#FDF9F5] p-5 sm:p-7 rounded-3xl border border-[#E7DFD6] shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="gift-toggle"
                className="flex items-center gap-3 cursor-pointer select-none"
              >
                <div className="w-9 h-9 rounded-full bg-brand-caramel/10 text-brand-caramel flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-heading font-semibold text-sm sm:text-base text-brand-chocolate block">
                    {lang === 'bn' ? 'কাউকে উপহার বা সারপ্রাইজ পাঠাচ্ছেন?' : 'Sending as a Gift or Surprise?'}
                  </span>
                  <span className="text-[13px] text-brand-taupe block">
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
              <div className="pt-3 border-t border-[#E7DFD6] space-y-3.5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[13px] font-semibold uppercase tracking-wider text-brand-chocolate/80 mb-1">
                      {lang === 'bn' ? 'প্রাপকের নাম' : 'Recipient Name'}
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: আয়েশা সিদ্দিকা' : 'e.g. Ayesha Siddika'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7DFD6] bg-white focus:outline-none focus:border-brand-caramel text-[13px] sm:text-sm text-brand-chocolate"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold uppercase tracking-wider text-brand-chocolate/80 mb-1">
                      {lang === 'bn' ? 'প্রাপকের ফোন নম্বর' : 'Recipient Phone (Optional)'}
                    </label>
                    <input
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder={lang === 'bn' ? '01XXXXXXXXX' : '01XXXXXXXXX'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7DFD6] bg-white focus:outline-none focus:border-brand-caramel text-[13px] sm:text-sm text-brand-chocolate"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold uppercase tracking-wider text-brand-chocolate/80 mb-1 flex items-center justify-between">
                    <span>{lang === 'bn' ? 'হাতে লেখা শুভেচ্ছা বার্তা' : 'Handwritten Card Message'}</span>
                    <span className="text-[13px] text-brand-taupe font-normal">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E7DFD6] bg-white focus:outline-none focus:border-brand-caramel text-[13px] sm:text-sm text-brand-chocolate resize-none"
                  />
                  <p className="text-[13px] text-brand-caramel flex items-center gap-1 mt-1">
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
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-[#E7DFD6] shadow-soft space-y-5">
            <div className="flex items-center gap-2.5 border-b border-[#E7DFD6] pb-3.5">
              <div className="w-7 h-7 rounded-full bg-brand-caramel/10 text-brand-caramel flex items-center justify-center font-bold text-[13px]">
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
                    ? 'border-brand-caramel bg-brand-caramel/10 shadow-soft ring-1 ring-brand-caramel/20'
                    : 'border-[#E7DFD6] hover:border-brand-caramel/40 bg-white'
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-brand-chocolate flex items-center gap-1.5 min-w-0">
                      <Banknote className="w-4 h-4 text-brand-caramel shrink-0" />
                      {t('checkout.codLabel')}
                    </span>
                    <span className={`text-[13px] font-bold ${lang === 'bn' ? '' : 'uppercase tracking-wider'} bg-brand-cream px-2 py-0.5 rounded text-brand-taupe shrink-0 whitespace-nowrap`}>
                      {lang === 'bn' ? 'জনপ্রিয়' : 'Standard'}
                    </span>
                  </div>
                  <p className="text-[13px] text-brand-taupe mt-1">
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
                    : 'border-[#E7DFD6] hover:border-[#E2136E]/40 bg-white'
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#8C1347] flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E2136E] inline-block shrink-0" />
                      {t('checkout.bkashLabel')}
                    </span>
                    <span className="text-[13px] font-bold tracking-wider bg-[#E2136E]/10 text-[#E2136E] px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      Send Money
                    </span>
                  </div>
                  <p className="text-[13px] text-brand-taupe mt-1">
                    {t('checkout.bkashDesc')}
                  </p>
                </div>
              </label>
              )}

              {/* bKash Details Expandable Box */}
              {paymentMethod === 'bkash' && (
                <div className="bg-[#FFF8FA] border border-[#E2136E]/20 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn text-[13px] text-brand-chocolate ml-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2136E]/15 pb-2.5">
                    <div className="flex items-center gap-1.5 text-[#8C1347] font-bold text-[13px] uppercase tracking-wider min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-[#E2136E] shrink-0" />
                      <span>Sweet Cravings bKash Wallet</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { if (bkashNumber) handleCopy(bkashNumber, 'bkash'); }}
                      disabled={!bkashNumber}
                      className="flex items-center gap-1.5 text-[13px] bg-white border border-[#E2136E]/30 text-[#8C1347] px-3 py-1 rounded-full font-bold shadow-xs hover:bg-[#FFEBF1] transition-colors shrink-0 whitespace-nowrap ml-auto"
                    >
                      {copiedKey === 'bkash' ? <Check className="w-3 h-3 text-brand-forest" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'bkash' ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy Number')}</span>
                    </button>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#E2136E]/15 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-mono text-lg font-extrabold text-brand-chocolate tracking-wide">
                        {bkashNumber || (lang === 'bn' ? 'নম্বর এখনো দেওয়া হয়নি' : 'Number not set yet')}
                      </p>
                      <p className="text-[13px] text-brand-taupe">
                        Type: <span className="font-semibold text-brand-chocolate capitalize">{shopSettings?.bkash_type || 'Personal'}</span> (Send Money)
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-auto">
                      <span className="text-[13px] text-brand-taupe uppercase block">Pay Exact</span>
                      <span className="font-heading font-extrabold text-[#8C1347] text-base">৳{payableTotal}</span>
                    </div>
                  </div>

                  {/* Step Instructions */}
                  <div className="space-y-1.5 text-brand-taupe text-[13px] leading-relaxed bg-white/70 p-3 rounded-xl border border-[#E2136E]/10">
                    <p className="font-bold text-brand-chocolate mb-1">
                      {lang === 'bn' ? 'পেমেন্ট নির্দেশিকা:' : 'Payment Instructions:'}
                    </p>
                    <p>1. bKash অ্যাপ ওপেন করে <strong>Send Money</strong> অপশন নির্বাচন করুন।</p>
                    <p>2. প্রাপক নম্বরে উপরের নম্বরটি দিয়ে মোট <strong>৳{payableTotal}</strong> সেন্ড করুন।</p>
                    <p>3. পেমেন্ট সম্পন্ন হলে প্রাপ্ত <strong>TrxID (Transaction ID)</strong> নিচের বক্সে দিন — TrxID ছাড়া অর্ডারটি নেওয়া হবে না।</p>
                  </div>

                  <div>
                    <label className="block font-bold text-[13px] text-brand-chocolate mb-1.5">
                      {t('checkout.senderNumberLabel')} <span className="text-[#E2136E]">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={senderNumber}
                      onChange={(e) => { setSenderNumber(e.target.value); setSenderError(null); }}
                      placeholder={t('checkout.senderNumberPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E2136E]/30 bg-white text-sm font-mono tracking-wider focus:outline-none focus:border-[#E2136E] focus:ring-2 focus:ring-[#E2136E]/20"
                    />
                    {senderError && (
                      <p className="text-[13px] text-red-600 mt-1.5 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{senderError}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-[13px] text-brand-chocolate mb-1.5">
                      {t('checkout.walletTrxRequired')} <span className="text-[#E2136E]">*</span>
                    </label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => { setTrxId(e.target.value); setTrxError(null); }}
                      placeholder={t('checkout.walletTrxPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E2136E]/30 bg-white text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-[#E2136E] focus:ring-2 focus:ring-[#E2136E]/20"
                    />
                    {trxError && (
                      <p className="text-[13px] text-red-600 mt-1.5 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{trxError}</span>
                      </p>
                    )}
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
                    : 'border-[#E7DFD6] hover:border-[#F7941D]/40 bg-white'
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-[#A35200] flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F7941D] inline-block shrink-0" />
                      {t('checkout.nagadLabel')}
                    </span>
                    <span className="text-[13px] font-bold tracking-wider bg-[#F7941D]/10 text-[#F7941D] px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      Send Money
                    </span>
                  </div>
                  <p className="text-[13px] text-brand-taupe mt-1">
                    {t('checkout.nagadDesc')}
                  </p>
                </div>
              </label>
              )}

              {/* Nagad Details Expandable Box */}
              {paymentMethod === 'nagad' && (
                <div className="bg-[#FFFBF5] border border-[#F7941D]/20 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn text-[13px] text-brand-chocolate ml-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F7941D]/15 pb-2.5">
                    <div className="flex items-center gap-1.5 text-[#A35200] font-bold text-[13px] uppercase tracking-wider min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-[#F7941D] shrink-0" />
                      <span>Sweet Cravings Nagad Wallet</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { if (nagadNumber) handleCopy(nagadNumber, 'nagad'); }}
                      disabled={!nagadNumber}
                      className="flex items-center gap-1.5 text-[13px] bg-white border border-[#F7941D]/30 text-[#A35200] px-3 py-1 rounded-full font-bold shadow-xs hover:bg-[#FFF3E3] transition-colors shrink-0 whitespace-nowrap ml-auto"
                    >
                      {copiedKey === 'nagad' ? <Check className="w-3 h-3 text-brand-forest" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'nagad' ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy Number')}</span>
                    </button>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-[#F7941D]/15 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-mono text-lg font-extrabold text-brand-chocolate tracking-wide">
                        {nagadNumber || (lang === 'bn' ? 'নম্বর এখনো দেওয়া হয়নি' : 'Number not set yet')}
                      </p>
                      <p className="text-[13px] text-brand-taupe">
                        Type: <span className="font-semibold text-brand-chocolate capitalize">{shopSettings?.nagad_type || 'Personal'}</span> (Send Money)
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-auto">
                      <span className="text-[13px] text-brand-taupe uppercase block">Pay Exact</span>
                      <span className="font-heading font-extrabold text-[#A35200] text-base">৳{payableTotal}</span>
                    </div>
                  </div>

                  {/* Step Instructions */}
                  <div className="space-y-1.5 text-brand-taupe text-[13px] leading-relaxed bg-white/70 p-3 rounded-xl border border-[#F7941D]/10">
                    <p className="font-bold text-brand-chocolate mb-1">
                      {lang === 'bn' ? 'পেমেন্ট নির্দেশিকা:' : 'Payment Instructions:'}
                    </p>
                    <p>1. Nagad অ্যাপ ওপেন করে <strong>Send Money</strong> অপশন নির্বাচন করুন।</p>
                    <p>2. প্রাপক নম্বরে উপরের নম্বরটি দিয়ে মোট <strong>৳{payableTotal}</strong> সেন্ড করুন।</p>
                    <p>3. পেমেন্ট সম্পন্ন হলে প্রাপ্ত <strong>TrxID</strong> নিচের বক্সে দিন — TrxID ছাড়া অর্ডারটি নেওয়া হবে না।</p>
                  </div>

                  <div>
                    <label className="block font-bold text-[13px] text-brand-chocolate mb-1.5">
                      {t('checkout.senderNumberLabel')} <span className="text-[#F7941D]">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={senderNumber}
                      onChange={(e) => { setSenderNumber(e.target.value); setSenderError(null); }}
                      placeholder={t('checkout.senderNumberPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#F7941D]/30 bg-white text-sm font-mono tracking-wider focus:outline-none focus:border-[#F7941D] focus:ring-2 focus:ring-[#F7941D]/20"
                    />
                    {senderError && (
                      <p className="text-[13px] text-red-600 mt-1.5 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{senderError}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-[13px] text-brand-chocolate mb-1.5">
                      {t('checkout.walletTrxRequired')} <span className="text-[#F7941D]">*</span>
                    </label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => { setTrxId(e.target.value); setTrxError(null); }}
                      placeholder={t('checkout.walletTrxPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#F7941D]/30 bg-white text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-[#F7941D] focus:ring-2 focus:ring-[#F7941D]/20"
                    />
                    {trxError && (
                      <p className="text-[13px] text-red-600 mt-1.5 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{trxError}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Right Sticky Column: Order Summary & Review */}
        <div className="lg:col-span-5">
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-[#E7DFD6] shadow-soft space-y-6 sticky top-28">
            
            <div className="border-b border-[#E7DFD6] pb-3.5 flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('checkout.orderSummary')}
              </h2>
              <span className="text-[13px] bg-brand-cream px-2.5 py-0.5 rounded-full text-brand-taupe font-semibold">
                {items.reduce((s, i) => s + i.quantity, 0)} {lang === 'bn' ? 'আইটেম' : 'items'}
              </span>
            </div>

            {/* Cart item breakdown */}
            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-center text-[13px]">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-brand-cream shrink-0 border border-[#E7DFD6]">
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
                    <p className="text-brand-taupe text-[13px] mt-0.5">
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
            <div className="border-t border-[#E7DFD6] pt-3.5 space-y-2">
              <label className="block text-[13px] font-bold text-brand-chocolate flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-caramel" />
                  <span>{lang === 'bn' ? 'প্রোমো কোড / কুপন' : 'Have a Promo Code?'}</span>
                </span>
                {!appliedCoupon && (
                  <span className="text-[13px] text-brand-taupe font-normal">
                    Try: <button type="button" onClick={() => handleApplyCoupon('WELCOME50')} className="font-mono font-bold text-brand-caramel underline">WELCOME50</button>
                  </span>
                )}
              </label>

              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-brand-forest/10 border border-brand-forest/20 text-brand-forest px-3.5 py-2.5 rounded-xl text-[13px]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-forest" />
                    <div>
                      <span className="font-mono font-bold tracking-wider">{appliedCoupon.code}</span>
                      <span className="text-brand-taupe text-[13px] block">Saved ৳{appliedCoupon.discountAmount} on this order</span>
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
                      className="flex-1 px-3 py-2 rounded-xl border border-[#E7DFD6] bg-brand-cream/50 text-[13px] font-mono uppercase tracking-wider focus:bg-white focus:outline-none focus:border-brand-caramel"
                    />
                    <button
                      type="button"
                      disabled={isValidatingCoupon || !couponInput.trim()}
                      onClick={() => handleApplyCoupon()}
                      className="bg-brand-chocolate hover:bg-brand-chocolate text-brand-cream px-4 py-2 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
                    >
                      {isValidatingCoupon ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-[13px] text-brand-chocolate animate-fadeIn flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{couponError}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="border-t border-[#E7DFD6] pt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-brand-taupe text-[13px] sm:text-sm">
                <span>{t('cart.subtotal')}</span>
                <span className="font-semibold text-brand-chocolate">৳{subtotal}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-brand-forest text-[13px] sm:text-sm animate-fadeIn">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Coupon ({appliedCoupon?.code})</span>
                  </span>
                  <span className="font-bold">-৳{discountAmount}</span>
                </div>
              )}

              <div className="flex justify-between text-brand-taupe text-[13px] sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-brand-caramel" />
                  <span>{t('cart.deliveryFee')}</span>
                </span>
                <span className="font-semibold">
                  {deliveryFee === 0 ? (
                    <span className="text-brand-forest font-bold bg-brand-forest/10 px-2 py-0.5 rounded text-[13px]">
                      {lang === 'bn' ? 'ফ্রি ডেলিভারি' : 'FREE'}
                    </span>
                  ) : (
                    `৳${deliveryFee}`
                  )}
                </span>
              </div>

              <div className="border-t border-[#E7DFD6] pt-3 flex justify-between font-heading text-lg font-bold text-brand-chocolate items-baseline">
                <div>
                  <span>{t('cart.total')}</span>
                  <span className="text-[13px] text-brand-taupe block font-normal font-sans">
                    {lang === 'bn' ? 'সকল চার্জ অন্তর্ভুক্ত' : 'Includes all local taxes'}
                  </span>
                </div>
                <span className="text-brand-caramel font-extrabold text-2xl">৳{payableTotal}</span>
              </div>
            </div>

            {/* Wallet notice: the order is NOT submitted until the TrxID
                is sent — pay now and enter it, or save the order and
                finish it after paying. */}
            {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-2xl text-[13px] leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('checkout.notSubmittedNote')}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isSavingDraft}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-sm shadow-soft transition-all flex items-center justify-center gap-2 btn-press ${
                isSubmitting
                  ? 'bg-brand-chocolate/5 text-brand-taupe cursor-wait'
                  : 'bg-brand-chocolate hover:bg-brand-chocolate text-white hover:shadow-card'
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
                  <span>{(paymentMethod === 'bkash' || paymentMethod === 'nagad') ? t('checkout.submitOrder') : t('checkout.placeOrder')} (৳{payableTotal})</span>
                </>
              )}
            </button>

            {/* Save and pay later — wallet only: saves the order as a
                draft the customer finishes with the TrxID after paying. */}
            {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting || isSavingDraft}
                className="w-full py-3.5 px-6 rounded-2xl font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2 bg-white hover:bg-brand-cream text-brand-chocolate border border-[#E7DFD6] disabled:opacity-60"
              >
                {isSavingDraft ? (
                  <>
                    <div className="w-4 h-4 border-2 border-brand-chocolate border-t-transparent rounded-full animate-spin" />
                    <span>{t('checkout.savingDraft')}</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>{t('checkout.saveDraft')}</span>
                  </>
                )}
              </button>
            )}

            {/* Security Guarantee */}
            <div className="space-y-2 text-[13px] text-brand-taupe text-center pt-1 border-t border-[#E7DFD6]">
              <p className="flex items-center justify-center gap-1.5 text-brand-chocolate/80 font-medium">
                <ShieldCheck className="w-4 h-4 text-brand-forest shrink-0" />
                <span>{lang === 'bn' ? 'নিরাপদ ঘরোয়া অর্ডার • তাজা বেকিং গ্যারান্টি' : 'Safe Guest Order • Fresh Baking Guarantee'}</span>
              </p>
              <p className="text-[13px]">
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
