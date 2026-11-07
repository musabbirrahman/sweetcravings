'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { Order } from '@/lib/types';
import Confetti from '@/components/Confetti';
import { 
  CheckCircle, 
  Clock, 
  MapPin, 
  Phone, 
  CreditCard, 
  Send, 
  Check, 
  Copy, 
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Printer,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  Gift
} from 'lucide-react';
import LoyaltyStampCard from '@/components/LoyaltyStampCard';
import { LoyaltyInfo } from '@/lib/types';

export default function OrderConfirmationPage({ params }: { params: { publicCode: string } }) {
  const { lang, t } = useLanguage();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trxIdInput, setTrxIdInput] = useState('');
  const [submittingTrx, setSubmittingTrx] = useState(false);
  const [trxSuccessMessage, setTrxSuccessMessage] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);
  // The order is only shown after phone verification. Checkout stores the
  // phone in this browser session; anyone arriving by a shared link is
  // asked to enter the phone number used for the order.
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('');

  const fetchOrder = (phone?: string) => {
    const phoneToUse = phone ?? verifiedPhone;
    if (!phoneToUse) {
      setLoading(false);
      return;
    }
    setVerifiedPhone(phoneToUse);
    setLoading(true);
    setError(null);
    fetch(`/api/orders/${params.publicCode}?phone=${encodeURIComponent(phoneToUse)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.order) {
          setOrder(data.order);
          if (data.settings) setShopSettings(data.settings);
          if (data.order.customer_phone) {
            fetch(`/api/loyalty?phone=${encodeURIComponent(data.order.customer_phone)}`)
              .then((res) => res.json())
              .then((loyaltyData) => {
                if (loyaltyData.success && loyaltyData.loyalty) {
                  setLoyalty(loyaltyData.loyalty);
                }
              })
              .catch(() => {});
          }
        } else {
          setError(data.error || 'Order not found');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let storedPhone: string | null = null;
    try {
      storedPhone = sessionStorage.getItem('sc_order_phone');
    } catch {}
    if (storedPhone) {
      fetchOrder(storedPhone);
    } else {
      setLoading(false);
    }
  }, [params.publicCode]);

  const handlePhoneVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    fetchOrder(phoneInput.trim());
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(params.publicCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPhone = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleTrxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxIdInput.trim()) return;

    setSubmittingTrx(true);
    try {
      const res = await fetch(`/api/orders/${params.publicCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trxId: trxIdInput.trim(), phone: verifiedPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setTrxSuccessMessage(true);
        setTrxIdInput('');
        fetchOrder();
        setTimeout(() => setTrxSuccessMessage(false), 5000);
      } else {
        alert(data.error || 'Failed to update TrxID');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting TrxID');
    } finally {
      setSubmittingTrx(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-28 text-center space-y-4">
        <div className="w-12 h-12 mx-auto border-3 border-brand-caramel border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-brand-taupe">
          {lang === 'bn' ? 'অর্ডারের বিবরণ লোড হচ্ছে...' : 'Loading order details...'}
        </p>
      </div>
    );
  }

  if (error || !order) {
    // No phone on file for this visit (e.g. a shared link): ask for the
    // phone number used for the order instead of showing the order.
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-brand-caramel-subtle flex items-center justify-center text-brand-caramel">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="font-heading text-2xl font-bold text-brand-chocolate">
          {lang === 'bn' ? 'অর্ডার দেখতে ফোন নম্বর দিন' : 'Verify your order'}
        </h2>
        <p className="text-sm text-brand-taupe">
          {lang === 'bn'
            ? 'এই অর্ডারটি দেখতে অর্ডারের সময় দেওয়া মোবাইল নম্বরটি লিখুন।'
            : 'Enter the phone number used for this order to view it.'}
        </p>
        {error && (
          <p className="text-sm text-brand-strawberry font-semibold">{error}</p>
        )}
        <form onSubmit={handlePhoneVerify} className="space-y-3">
          <input
            type="tel"
            required
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder={lang === 'bn' ? 'যেমন: 01712345678' : 'e.g. 01712345678'}
            className="w-full px-4 py-3 rounded-xl border border-brand-cream-dark bg-white text-sm text-brand-chocolate focus:outline-none focus:border-brand-caramel"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-caramel hover:bg-brand-caramel-dark text-white font-bold py-3 px-6 rounded-xl text-sm shadow-soft transition-all"
          >
            {loading
              ? (lang === 'bn' ? 'যাচাই করা হচ্ছে…' : 'Verifying…')
              : (lang === 'bn' ? 'অর্ডার দেখুন' : 'View Order')}
          </button>
        </form>
        <Link
          href="/track"
          className="inline-block text-sm font-bold text-brand-caramel hover:underline"
        >
          {lang === 'bn' ? 'অর্ডার ট্র্যাক করুন' : 'Track an order instead'}
        </Link>
      </div>
    );
  }

  // Timeline Stages
  const orderStages = [
    { 
      key: 'new', 
      labelEn: 'Order Placed', 
      labelBn: 'অর্ডার গৃহীত',
      descEn: 'We received your order',
      descBn: 'অর্ডারটি পাওয়া গেছে'
    },
    { 
      key: 'accepted', 
      labelEn: 'Accepted', 
      labelBn: 'কনফার্ম',
      descEn: 'Kitchen confirmed details',
      descBn: 'কিচেন নিশ্চিত করেছে'
    },
    { 
      key: 'preparing', 
      labelEn: 'Baking Fresh', 
      labelBn: 'তাজা তৈরি হচ্ছে',
      descEn: 'Fresh handmade baking',
      descBn: 'তাজা বেক করা হচ্ছে'
    },
    { 
      key: 'ready', 
      labelEn: 'Packed Fresh', 
      labelBn: 'প্যাকেট সম্পন্ন',
      descEn: 'Chilled & packaged carefully',
      descBn: 'যত্মসহকারে প্যাক করা হয়েছে'
    },
    { 
      key: 'out_for_delivery', 
      labelEn: 'On the Way', 
      labelBn: 'ডেলিভারি চলছে',
      descEn: 'Rider is arriving soon',
      descBn: 'রাইডার পথে রয়েছে'
    },
    { 
      key: 'completed', 
      labelEn: 'Delivered', 
      labelBn: 'ডেলিভার্ড',
      descEn: 'Enjoy your sweet cravings!',
      descBn: 'মিষ্টি মুহূর্ত উপভোগ করুন!'
    },
  ];

  const currentStageIndex = orderStages.findIndex((s) => s.key === order.order_status);

  // Prefilled WhatsApp message
  const waText = encodeURIComponent(
    `Salam Sweet Cravings! I placed Order #${order.public_code} for ${order.customer_name}. Total: BDT ${order.total_amount}.`
  );
  const rawWa = (shopSettings?.whatsapp_number || '').replace(/\D/g, '');
  const waPhone = rawWa.startsWith('88') ? rawWa : `88${rawWa}`;
  const waUrl = rawWa ? `https://wa.me/${waPhone}?text=${waText}` : '';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-8 font-sans">
      
      {/* Visual Confetti particle celebration */}
      <Confetti />

      {/* Success Celebration Card */}
      <div className="bg-white/95 rounded-3xl p-6 sm:p-10 border border-brand-cream-dark/90 shadow-card text-center space-y-6 relative overflow-hidden">
        
        {/* Soft background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-28 bg-brand-gold-light/20 blur-3xl rounded-full pointer-events-none" />

        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-brand-forest-light text-brand-forest flex items-center justify-center shadow-soft">
          <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-forest bg-brand-forest-light px-3.5 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'অর্ডার সফলভাবে গৃহীত হয়েছে!' : 'Order Placed Successfully!'}</span>
          </span>
          <h1 className="font-heading text-2xl sm:text-4xl font-semibold text-brand-chocolate">
            {t('orderConfirm.successTitle')}
          </h1>
          <p className="text-sm text-brand-taupe max-w-md mx-auto leading-relaxed">
            {t('orderConfirm.successSubtitle')}
          </p>
        </div>

        {/* Public Order Reference Code Box */}
        <div className="bg-brand-cream-subtle/70 border border-brand-cream-dark rounded-2xl p-4 sm:p-5 max-w-sm mx-auto space-y-2 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider font-bold text-brand-taupe block">
            {t('orderConfirm.orderRef')}
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold text-brand-chocolate tracking-wider">
              {order.public_code}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-2 rounded-xl bg-white border border-brand-cream-dark text-brand-chocolate hover:bg-brand-cream transition-colors shadow-xs active:scale-95"
              title="Copy Order Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-brand-forest" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-brand-taupe">
            {t('orderConfirm.orderRefHelp')}
          </p>
        </div>

        {/* Quick Actions: WhatsApp Concierge + Print Receipt */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-forest hover:bg-[#1E4330] text-white font-bold py-3 px-6 rounded-full text-sm shadow-soft transition-all active:scale-98"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t('orderConfirm.whatsAppCTA')}</span>
          </a>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-white hover:bg-brand-cream text-brand-chocolate font-semibold py-3 px-5 rounded-full text-sm border border-brand-cream-dark shadow-xs transition-all active:scale-98"
          >
            <Printer className="w-4 h-4 text-brand-caramel" />
            <span>{lang === 'bn' ? 'রশিদ প্রিন্ট করুন' : 'Print Receipt'}</span>
          </button>
        </div>

        <p className="text-[11px] text-brand-taupe">
          {t('orderConfirm.whatsAppNotice')}
        </p>
      </div>

      {/* Animated Order Status Timeline */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-brand-cream-dark shadow-soft space-y-5">
        <div className="flex items-center justify-between border-b border-brand-cream-dark pb-3.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-caramel" />
            <h2 className="font-heading font-bold text-lg text-brand-chocolate">
              {t('orderConfirm.statusTimeline')}
            </h2>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-brand-caramel-subtle text-brand-caramel border border-brand-caramel/20 capitalize">
            {order.order_status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Stepper with Glowing Active Pulse */}
        <div className="py-3">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 sm:gap-2">
            {orderStages.map((stage, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <div key={stage.key} className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-1.5 text-left sm:text-center">
                  <div className="relative">
                    {/* Glowing pulse ring if current */}
                    {isCurrent && (
                      <span className="absolute -inset-1 rounded-full bg-brand-caramel/30 animate-ping opacity-75" />
                    )}
                    <div
                      className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                        isCurrent
                          ? 'bg-brand-caramel text-white ring-4 ring-brand-caramel-subtle'
                          : isPast
                          ? 'bg-brand-forest text-white'
                          : 'bg-brand-cream-subtle text-brand-taupe/50 border border-brand-cream-dark'
                      }`}
                    >
                      {isPast ? <Check className="w-4 h-4" /> : idx + 1}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`text-xs block font-bold ${
                        isCurrent ? 'text-brand-caramel font-extrabold' : isPast ? 'text-brand-chocolate' : 'text-brand-taupe/70'
                      }`}
                    >
                      {lang === 'bn' ? stage.labelBn : stage.labelEn}
                    </span>
                    <span className="text-[10px] text-brand-taupe hidden sm:block mt-0.5">
                      {lang === 'bn' ? stage.descBn : stage.descEn}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Manual Payment Section (bKash / Nagad) */}
      {(order.payment_method === 'bkash' || order.payment_method === 'nagad') && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-brand-cream-dark shadow-soft space-y-5">
          <div className="flex items-center justify-between border-b border-brand-cream-dark pb-3.5">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-caramel" />
              <h2 className="font-heading font-bold text-lg text-brand-chocolate">
                {t('orderConfirm.paymentInstructionsTitle')} ({order.payment_method.toUpperCase()})
              </h2>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                order.payment_status === 'confirmed'
                  ? 'bg-brand-forest-light text-brand-forest'
                  : order.payment_status === 'submitted'
                  ? 'bg-brand-vanilla text-brand-caramel'
                  : 'bg-brand-strawberry-light text-brand-strawberry'
              }`}
            >
              {order.payment_status === 'confirmed'
                ? (lang === 'bn' ? 'পেমেন্ট নিশ্চিত হয়েছে' : 'Payment Confirmed')
                : order.payment_status === 'submitted'
                ? (lang === 'bn' ? 'TrxID যাচাই চলছে' : 'TrxID Under Review')
                : (lang === 'bn' ? 'পেমেন্ট অপেক্ষমাণ' : 'Payment Pending')}
            </span>
          </div>

          <div className="text-xs sm:text-sm text-brand-taupe space-y-3">
            <p>
              {lang === 'bn' 
                ? `অনুগ্রহ করে আমাদের ভেরিফায়েড ${order.payment_method.toUpperCase()} নম্বরে নির্ধারিত `
                : `Please send exact `}
              <strong className="text-brand-chocolate text-base">৳{order.total_amount}</strong>
              {lang === 'bn' ? ` সেন্ড মানি করুন:` : ` to our verified ${order.payment_method.toUpperCase()} account:`}
            </p>

            {(() => {
              const isNagad = order.payment_method === 'nagad';
              const walletNum = isNagad
                ? (shopSettings?.nagad_number || '')
                : (shopSettings?.bkash_number || '');
              const walletType = isNagad
                ? (shopSettings?.nagad_type || 'Personal')
                : (shopSettings?.bkash_type || 'Personal');

              return (
                <div className="bg-brand-cream-subtle/80 p-4 rounded-2xl border border-brand-cream-dark flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xl font-extrabold text-brand-chocolate">
                      {walletNum || (lang === 'bn' ? 'নম্বর এখনো দেওয়া হয়নি' : 'Number not set yet')}
                    </p>
                    <p className="text-[11px] text-brand-taupe capitalize">
                      {walletNum
                        ? `${walletType} Account (Send Money) • Sweet Cravings`
                        : (lang === 'bn' ? 'পেমেন্ট নম্বর সেট করা হয়নি — দয়া করে দোকানে যোগাযোগ করুন।' : 'Payment number not set yet — please contact the shop.')}
                    </p>
                  </div>
                  {walletNum && (
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(walletNum)}
                    className="flex items-center gap-1.5 text-xs bg-white border border-brand-cream-dark text-brand-chocolate px-3 py-1.5 rounded-xl font-bold shadow-xs hover:bg-brand-cream transition-colors"
                  >
                    {copiedPhone ? <Check className="w-3.5 h-3.5 text-brand-forest" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPhone ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'নম্বর কপি' : 'Copy')}</span>
                  </button>
                  )}
                </div>
              );
            })()}

            {/* TrxID Submit / Update Form */}
            {order.payment_status !== 'confirmed' && (
              <form onSubmit={handleTrxSubmit} className="pt-2 space-y-3">
                <label className="block text-xs font-bold text-brand-chocolate">
                  {lang === 'bn' ? 'পেমেন্ট শেষে TrxID সাবমিট করুন:' : 'Submit your Payment TrxID (Transaction ID):'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={trxIdInput}
                    onChange={(e) => setTrxIdInput(e.target.value)}
                    placeholder="e.g. 9J4K2L8M1N"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/50 text-sm font-mono uppercase tracking-wider focus:bg-white focus:outline-none focus:border-brand-caramel"
                  />
                  <button
                    type="submit"
                    disabled={submittingTrx}
                    className="bg-brand-caramel hover:bg-brand-caramel-dark text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-soft transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {submittingTrx ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{t('orderConfirm.submitTrx')}</span>
                  </button>
                </div>

                {trxSuccessMessage && (
                  <p className="text-xs text-brand-forest font-bold flex items-center gap-1 animate-fadeIn">
                    <Check className="w-4 h-4" />
                    <span>{t('orderConfirm.trxSuccessNotice')}</span>
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Order Itemized Receipt Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-brand-cream-dark shadow-soft space-y-5">
        <div className="border-b border-brand-cream-dark pb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-brand-caramel" />
            <h2 className="font-heading font-bold text-lg text-brand-chocolate">
              {t('orderConfirm.itemsTitle')}
            </h2>
          </div>
          <span className="text-xs text-brand-taupe">
            Order #{order.public_code}
          </span>
        </div>

        {/* Items List */}
        <div className="space-y-3 divide-y divide-brand-cream-subtle">
          {order.items?.map((item, idx) => (
            <div key={idx} className="pt-3 first:pt-0 flex justify-between items-center text-xs sm:text-sm">
              <div>
                <p className="font-bold text-brand-chocolate">
                  {lang === 'bn' ? item.product_name_bn : item.product_name_en}
                </p>
                <p className="text-brand-taupe text-[11px] mt-0.5">
                  {item.quantity} × ৳{item.unit_price}
                  {(item.variant_label_en || item.variant_label_bn) && (
                    <span> • {lang === 'bn' ? item.variant_label_bn : item.variant_label_en}</span>
                  )}
                </p>
              </div>
              <span className="font-bold text-brand-chocolate">
                ৳{item.line_total}
              </span>
            </div>
          ))}
        </div>

        {/* Pricing Subtotal & Delivery */}
        <div className="border-t border-brand-cream-dark pt-3 space-y-2 text-xs sm:text-sm text-brand-taupe">
          <div className="flex justify-between">
            <span>{t('cart.subtotal')}</span>
            <span className="font-semibold text-brand-chocolate">৳{order.subtotal}</span>
          </div>
          {order.discount_amount && order.discount_amount > 0 ? (
            <div className="flex justify-between text-brand-forest">
              <span>Discount ({order.coupon_code || 'Promo'})</span>
              <span className="font-bold">-৳{order.discount_amount}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>{t('cart.deliveryFee')}</span>
            <span className="font-semibold">
              {order.delivery_fee === 0 ? (
                <span className="text-brand-forest font-bold">{lang === 'bn' ? 'ফ্রি' : 'FREE'}</span>
              ) : (
                `৳${order.delivery_fee}`
              )}
            </span>
          </div>
          <div className="border-t border-brand-cream-dark pt-2.5 flex justify-between font-heading text-lg font-bold text-brand-chocolate items-baseline">
            <span>{t('cart.total')}</span>
            <span className="text-brand-caramel font-extrabold text-xl">৳{order.total_amount}</span>
          </div>
        </div>

        {/* Gift Order Card (if is_gift is true) */}
        {Boolean(order.is_gift) && (
          <div className="bg-[#FFF9F6] border border-brand-caramel/25 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-brand-caramel font-semibold">
              <Gift className="w-4 h-4" />
              <span>{lang === 'bn' ? 'বিশেষ উপহার প্যাকেজিং ও রিবন' : 'Special Gift Packaging & Silk Ribbon'}</span>
            </div>
            {order.recipient_name && (
              <p className="text-brand-chocolate">
                <strong>{lang === 'bn' ? 'উপহার প্রাপক:' : 'Recipient:'}</strong> {order.recipient_name}
                {order.recipient_phone && <span className="text-brand-taupe"> ({order.recipient_phone})</span>}
              </p>
            )}
            {order.gift_message && (
              <div className="bg-white/80 p-3 rounded-xl border border-brand-caramel/15 italic text-brand-chocolate">
                "{order.gift_message}"
              </div>
            )}
          </div>
        )}

        {/* Delivery Details Summary Box */}
        <div className="bg-brand-cream-subtle/50 rounded-2xl p-4 border border-brand-cream-dark text-xs space-y-2">
          <p className="font-bold text-brand-chocolate flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-brand-caramel" />
            <span>{lang === 'bn' ? 'ডেলিভারি ঠিকানা:' : 'Delivery Destination:'}</span>
          </p>
          <p className="text-brand-chocolate">
            <strong>{order.customer_name}</strong> • {order.customer_phone}
          </p>
          <p className="text-brand-taupe">
            {order.delivery_address}, {order.area_landmark}
          </p>
          {order.delivery_instructions && (
            <p className="text-brand-taupe italic">
              Note: {order.delivery_instructions}
            </p>
          )}
        </div>

        {/* Customer Sweet Rewards Loyalty Stamp Card */}
        {loyalty && (
          <div className="pt-2 animate-fade-in">
            <LoyaltyStampCard loyalty={loyalty} />
          </div>
        )}

      </div>

      {/* Bottom Navigation */}
      <div className="text-center pt-2">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-caramel hover:text-brand-caramel-dark hover:underline"
        >
          <span>{lang === 'bn' ? 'আরও সুস্বাদু মিষ্টি দেখুন' : 'Browse More Desserts'}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
