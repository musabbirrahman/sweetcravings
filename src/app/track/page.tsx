'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Order } from '@/lib/types';
import { 
  Search, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  ArrowRight,
  MapPin,
  MessageCircle,
  Truck,
  ShoppingBag
} from 'lucide-react';

export default function TrackOrderPage() {
  const { lang, t } = useLanguage();

  const [orderCode, setOrderCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCode.trim() || !phoneNumber.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSearched(true);
    setOrder(null);

    try {
      const code = orderCode.trim().toUpperCase();
      const res = await fetch(`/api/orders/${code}?phone=${encodeURIComponent(phoneNumber.trim())}`);
      const data = await res.json();

      if (res.ok && data.success && data.order) {
        setOrder(data.order);
        if (data.settings) setSettings(data.settings);
        // Keep the phone in this browser session only, so the full receipt
        // page can verify the same order without asking again.
        try {
          sessionStorage.setItem('sc_order_phone', phoneNumber.trim().replace(/\D/g, ''));
        } catch {}
      } else {
        setErrorMsg(t('track.notFound'));
      }
    } catch {
      setErrorMsg(t('track.notFound'));
    } finally {
      setLoading(false);
    }
  };

  const orderStages = [
    { key: 'new', labelEn: 'Order Placed', labelBn: 'অর্ডার গৃহীত' },
    { key: 'accepted', labelEn: 'Accepted', labelBn: 'কনফার্ম' },
    { key: 'preparing', labelEn: 'Baking Fresh', labelBn: 'তাজা তৈরি হচ্ছে' },
    { key: 'ready', labelEn: 'Ready', labelBn: 'প্রস্তুত' },
    { key: 'out_for_delivery', labelEn: 'Out for Delivery', labelBn: 'ডেলিভারি চলছে' },
    { key: 'completed', labelEn: 'Delivered', labelBn: 'ডেলিভার্ড' },
  ];

  const currentStageIndex = order ? orderStages.findIndex((s) => s.key === order.order_status) : -1;

  // WhatsApp concierge link — only shown when a real number is configured.
  const rawWa = (settings?.whatsapp_number || '').replace(/\D/g, '');
  const waPhone = rawWa.startsWith('88') ? rawWa : `88${rawWa}`;
  const waUrl = order && rawWa ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Salam Sweet Cravings! I am checking on my Order #${order.public_code}.`)}` : '';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8 font-sans">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-1.5 bg-brand-caramel/10 text-brand-caramel text-[13px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
          <Truck className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'লাইভ অর্ডার ট্র্যাকিং' : 'Live Order Tracking'}</span>
        </div>
        <h1 className="font-heading text-[32px] sm:text-[40px] font-bold text-brand-chocolate leading-[1.15]">
          {t('track.title')}
        </h1>
        <p className="text-sm text-brand-taupe leading-[1.78]">
          {t('track.subtitle')}
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E7DFD6] shadow-soft space-y-5">
        <form onSubmit={handleTrack} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                {t('track.codeLabel')} <span className="text-brand-chocolate">*</span>
              </label>
              <input
                type="text"
                required
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                placeholder={t('track.codePlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm uppercase font-mono tracking-wider text-brand-chocolate transition-all"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold uppercase tracking-wider text-brand-chocolate/80 mb-1.5">
                {t('track.phoneLabel')} <span className="text-brand-chocolate">*</span>
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={t('track.phonePlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-[#E7DFD6] bg-brand-cream/40 focus:bg-white focus:outline-none focus:border-brand-caramel text-sm text-brand-chocolate transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-chocolate hover:bg-brand-chocolate text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-soft hover:shadow-soft-hover transition-all active:scale-98"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('track.searching')}</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>{t('track.submit')}</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[13px] text-center text-brand-taupe flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="w-4 h-4 text-brand-forest" />
          <span>{lang === 'bn' ? 'গোপনীয়তা সুরক্ষাসহ ভেরিফায়েড অর্ডার স্ট্যাটাস অনুসন্ধান' : 'Privacy-protected verified order status lookup'}</span>
        </p>
      </div>

      {/* Not Found Alert */}
      {searched && errorMsg && !order && (
        <div className="bg-brand-caramel/10 border border-brand-chocolate/20 text-brand-chocolate p-5 rounded-2xl text-sm flex items-start gap-3 shadow-soft animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">{lang === 'bn' ? 'অর্ডার পাওয়া যায়নি' : 'Order Not Found'}</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Found Order Card */}
      {order && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Main Status Header */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E7DFD6] shadow-soft space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7DFD6] pb-4">
              <div>
                <span className="text-[13px] uppercase font-bold tracking-wider text-brand-taupe block">
                  {lang === 'bn' ? 'অর্ডার নম্বর' : 'Order Reference'}
                </span>
                <span className="font-mono text-2xl font-extrabold text-brand-chocolate">
                  #{order.public_code}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold px-3.5 py-1 rounded-full bg-brand-caramel/10 text-brand-caramel border border-brand-caramel/20 capitalize">
                  {order.order_status === 'draft'
                    ? (lang === 'bn' ? 'সংরক্ষিত' : 'Saved')
                    : order.order_status.replace(/_/g, ' ')}
                </span>
                <span className="text-[13px] font-bold px-3 py-1 rounded-full bg-brand-cream text-brand-chocolate capitalize">
                  {order.payment_method.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Saved draft: not submitted yet — the customer pays, then
                submits the TrxID on the full receipt page. */}
            {order.order_status === 'draft' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-[13px] leading-relaxed space-y-2">
                <p className="font-bold">
                  {lang === 'bn' ? 'সংরক্ষিত — এখনো সাবমিট হয়নি' : 'Saved — not submitted yet'}
                </p>
                <p>
                  {lang === 'bn'
                    ? 'এই অর্ডারটি এখনো সাবমিট হয়নি। অ্যাপে পেমেন্ট করে সম্পূর্ণ রশিদ পেজে TrxID সাবমিট করুন — তখনই অর্ডারটি সাবমিট হবে।'
                    : 'This order is not submitted yet. Pay in the app, then submit the TrxID on the full receipt page — that is when the order is submitted.'}
                </p>
                <Link
                  href={`/order/${order.public_code}`}
                  className="inline-flex items-center gap-1.5 font-bold text-amber-800 underline"
                >
                  <span>{lang === 'bn' ? 'TrxID সাবমিট করতে রশিদ দেখুন' : 'View receipt to submit the TrxID'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Stepper with Glowing Pulse — hidden for drafts: the order
                is not in the pipeline until the TrxID is sent. */}
            {order.order_status !== 'draft' && (
            <div className="py-2">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-left sm:text-center">
                {orderStages.map((stage, idx) => {
                  const isPast = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  return (
                    <div key={stage.key} className="flex sm:flex-col items-center gap-2.5 sm:gap-1.5">
                      <div className="relative">
                        {isCurrent && (
                          <span className="absolute -inset-1 rounded-full bg-brand-caramel/30 animate-ping opacity-75" />
                        )}
                        <div
                          className={`relative w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all shadow-xs ${
                            isCurrent
                              ? 'bg-brand-chocolate text-white ring-4 ring-brand-caramel/10'
                              : isPast
                              ? 'bg-brand-forest text-white'
                              : 'bg-brand-cream text-brand-taupe/40 border border-[#E7DFD6]'
                          }`}
                        >
                          {isPast ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>
                      </div>
                      <span
                        className={`text-[13px] block font-bold ${
                          isCurrent ? 'text-brand-caramel font-extrabold' : isPast ? 'text-brand-chocolate' : 'text-brand-taupe/60'
                        }`}
                      >
                        {lang === 'bn' ? stage.labelBn : stage.labelEn}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Order Items Summary */}
            <div className="border-t border-[#E7DFD6] pt-4 space-y-3">
              <div className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-brand-chocolate">
                <ShoppingBag className="w-4 h-4 text-brand-caramel" />
                <span>{lang === 'bn' ? 'অর্ডারকৃত মিষ্টি' : 'Ordered Desserts'}</span>
              </div>
              <div className="space-y-2 divide-y divide-brand-cream text-[13px]">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-brand-chocolate">
                        {lang === 'bn' ? item.product_name_bn : item.product_name_en}
                      </p>
                      <p className="text-brand-taupe text-[13px]">
                        {item.quantity} × ৳{item.unit_price}
                      </p>
                    </div>
                    <span className="font-bold text-brand-chocolate">৳{item.line_total}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E7DFD6] pt-3 flex justify-between font-heading font-bold text-brand-chocolate text-base items-baseline">
                <span>{t('cart.total')}</span>
                <span className="text-brand-caramel text-xl font-extrabold">৳{order.total_amount}</span>
              </div>
            </div>

            {/* Delivery Destination */}
            <div className="bg-brand-cream/50 rounded-2xl p-4 border border-[#E7DFD6] text-[13px] space-y-1.5">
              <p className="font-bold text-brand-chocolate flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-caramel" />
                <span>{lang === 'bn' ? 'ডেলিভারি ঠিকানা' : 'Delivery Address'}</span>
              </p>
              <p className="text-brand-chocolate font-medium">{order.delivery_address}</p>
              <p className="text-brand-taupe">{order.area_landmark}</p>
            </div>

            {/* Direct WhatsApp Concierge CTA */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-brand-chocolate hover:bg-brand-chocolate text-white py-3 px-6 rounded-full font-bold text-[13px] shadow-soft transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{lang === 'bn' ? 'হোয়াটসঅ্যাপে আপডেট জানুন' : 'Live WhatsApp Updates'}</span>
              </a>
              )}

              <Link
                href={`/order/${order.public_code}`}
                className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-brand-cream text-brand-chocolate py-3 px-6 rounded-full font-semibold text-[13px] border border-[#E7DFD6] shadow-xs transition-all"
              >
                <span>{lang === 'bn' ? 'সম্পূর্ণ রশিদ দেখুন' : 'View Full Receipt'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
