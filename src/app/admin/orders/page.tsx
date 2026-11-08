'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { fetchAdminJson } from '@/lib/adminFetch';
import { Order, OrderStatus, PaymentStatus } from '@/lib/types';
import { useConfirm, useToast } from '@/components/DialogProvider';
import { 
  Search, 
  Phone, 
  MessageSquare, 
  Check, 
  X, 
  Clock, 
  MapPin, 
  ChefHat, 
  Truck, 
  CheckCircle2,
  Gift,
  Bike,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

const STATUS_FILTERS = [
  { id: 'all', labelEn: 'All', labelBn: 'সকল' },
  { id: 'new', labelEn: 'New', labelBn: 'নতুন' },
  { id: 'draft', labelEn: 'Saved', labelBn: 'সংরক্ষিত' },
  { id: 'accepted', labelEn: 'Accepted', labelBn: 'গৃহীত' },
  { id: 'preparing', labelEn: 'Preparing', labelBn: 'তৈরি হচ্ছে' },
  { id: 'ready', labelEn: 'Ready', labelBn: 'প্রস্তুত' },
  { id: 'out_for_delivery', labelEn: 'Out for Delivery', labelBn: 'ডেলিভারি' },
  { id: 'completed', labelEn: 'Completed', labelBn: 'সম্পন্ন' },
  { id: 'cancelled', labelEn: 'Cancelled', labelBn: 'বাতিল' },
];

function AdminOrdersContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get('status') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [orders, setOrders] = useState<Order[]>([]);  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  // Always fetch fresh (no-store): a new order must appear on refresh
  // without re-login. A 401 means the session is gone — send the operator
  // to the login page visibly instead of rendering an empty list that
  // still looks logged-in. Any other failure shows an error with Retry.
  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { status, data } = await fetchAdminJson('/api/orders');
      if (status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!data.success) {
        setLoadError(data.error || 'Could not load orders.');
        return;
      }
      setLoadError(null);
      setOrders(data.orders || []);
    } catch {
      setLoadError('Could not load orders. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOrders();
    // New orders arrive while the tab sits open: poll, and refetch the
    // moment the tab is focused or becomes visible again.
    const interval = setInterval(() => fetchOrders(true), 30000);
    const onVisible = () => {
      if (!document.hidden) fetchOrders(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId: number, newOrderStatus?: OrderStatus, newPaymentStatus?: PaymentStatus, note?: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderStatus: newOrderStatus,
          paymentStatus: newPaymentStatus,
          note,
          adminName: 'Sister / Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      } else {
        toast(data.error || 'Failed to update order', 'error');
      }
    } catch {
      toast('Error updating order', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const generateRiderWhatsAppUrl = (ord: Order) => {
    const isCOD = ord.payment_method === 'cod';
    const recipient = ord.recipient_name || ord.customer_name;
    const phone = ord.recipient_phone || ord.customer_phone;
    const itemsCount = ord.items?.reduce((s, i) => s + i.quantity, 0) || 0;
    
    const text = `🛵 *SWEET CRAVINGS — RIDER DISPATCH SLIP*
Order: #${ord.public_code}
──────────────────
📍 *Area:* ${ord.area_landmark}
🏠 *Address:* ${ord.delivery_address}
👤 *Recipient:* ${recipient} (${phone})
💰 *COLLECT CASH:* ৳${isCOD ? ord.total_amount : 0} ${isCOD ? '(COD - collect from customer)' : '(ALREADY PAID ONLINE - DO NOT COLLECT)'}
🧁 *Items to Deliver:* ${itemsCount} desserts (Handle with care / Chilled)
${ord.delivery_instructions ? `📝 *Note:* ${ord.delivery_instructions}\n` : ''}──────────────────
Sweet Cravings Kitchen`;

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Latest still-unreviewed TrxID submission, if any. The "payment not
  // received" button only shows while one exists.
  const getLatestPendingSubmission = (ord: Order) => {
    const pending = (ord.payment_submissions || []).filter((s) => s.review_state === 'pending');
    return pending.length > 0 ? pending[pending.length - 1] : undefined;
  };

  // Prefilled WhatsApp message to the customer (Bangla-first): order code,
  // submitted TrxID, amount and payment method, asking them to double-check
  // and reply with the correct TrxID. wa.me only prefills — the admin
  // still presses Send in WhatsApp, so a mis-tap sends nothing.
  const generatePaymentNotReceivedUrl = (ord: Order) => {
    const sub = getLatestPendingSubmission(ord);
    if (!sub) return '';
    const methodBn = sub.provider === 'nagad' ? 'নগদ' : 'বিকাশ';
    const text =
      `সালাম ${ord.customer_name}! Sweet Cravings থেকে বলছি। আপনার অর্ডার #${ord.public_code}-এর জন্য ${methodBn} নম্বরে ৳${ord.total_amount} পাঠিয়ে TrxID ${sub.transaction_ref} দিয়েছেন${sub.sender_number ? ` (যে নম্বর থেকে পাঠিয়েছেন: ${sub.sender_number})` : ''}, কিন্তু আমাদের হিসাবে এই পেমেন্টটি পাওয়া যায়নি।\n\n` +
      `দয়া করে TrxID-টি আবার যাচাই করে সঠিক TrxID-টি এই চ্যাটেই reply করুন, তাহলে আমরা আপনার অর্ডারটি নিশ্চিত করতে পারব।\n\nধন্যবাদ — Sweet Cravings, রাজশাহী`;
    return `https://wa.me/${ord.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  };

  // Record the notice through the existing PATCH path (sets payment_status
  // to 'rejected', marks the pending TrxID rejected, writes an event).
  // The WhatsApp tab opens from the same click via the link's href, so the
  // admin tab stays open and this request completes. The record means the
  // message was opened for sending — 'rejected' is also the only path to
  // that state, so the marker below is unambiguous.
  const handlePaymentNotReceived = (ord: Order) => {
    const sub = getLatestPendingSubmission(ord);
    if (!sub) return;
    handleUpdateStatus(
      ord.id,
      undefined,
      'rejected',
      `Payment not received — customer notified on WhatsApp (TrxID ${sub.transaction_ref}, ${sub.provider})`
    );
    toast(
      lang === 'bn'
        ? 'হোয়াটসঅ্যাপ খুলছে — পাঠাতে Send চাপুন'
        : 'Opening WhatsApp — press Send to notify the customer',
      'success'
    );
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = 
      selectedStatus === 'all' 
        ? true 
        : selectedStatus === 'active'
        ? (o.order_status === 'accepted' || o.order_status === 'preparing' || o.order_status === 'ready')
        : o.order_status === selectedStatus;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.public_code.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      o.area_landmark.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // A TrxID used on more than one order: the same payment cannot cover
  // two orders. Computed from the already-loaded orders (getAllOrders
  // attaches payment_submissions), so no extra request. Same-order
  // re-submits (old row rejected, new row pending) share one order code
  // and are NOT duplicates. This only marks what is already in the
  // data — new duplicates are refused at submission time, so this is a
  // backstop for duplicates from before that change. It never blocks
  // Confirm Payment: the admin still judges the order.
  const duplicateTrxOrderCodes = useMemo(() => {
    const byRef = new Map<string, Set<string>>();
    for (const o of orders) {
      for (const s of o.payment_submissions || []) {
        const key = s.transaction_ref.trim().toUpperCase();
        if (!key) continue;
        const set = byRef.get(key) || new Set<string>();
        set.add(o.public_code);
        byRef.set(key, set);
      }
    }
    const dup = new Map<string, string[]>();
    byRef.forEach((codes, key) => {
      if (codes.size > 1) dup.set(key, Array.from(codes));
    });
    return dup;
  }, [orders]);

  // Other orders carrying the same TrxID as `ref`, if any.
  const getDuplicateOrderCodes = (ref: string, ownCode: string): string[] =>
    (duplicateTrxOrderCodes.get(ref.trim().toUpperCase()) || []).filter((c) => c !== ownCode);

  return (
    <div className="space-y-6">
      
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            {t('admin.tabOrders')}
          </h1>
          <p className="text-sm text-brand-taupe">
            {orders.length} {t('admin.ordersCountLabel')}
          </p>
        </div>

        {/* Refresh + Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 bg-white border border-[#E7DFD6] text-brand-chocolate px-3 py-2 rounded-xl text-sm font-semibold hover:bg-brand-cream transition-colors shrink-0 disabled:opacity-60"
            title={lang === 'bn' ? 'অর্ডার তালিকা রিফ্রেশ করুন' : 'Refresh order list'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>
          <div className="relative max-w-xs w-full min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, name, phone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E7DFD6] bg-white text-sm focus:outline-none focus:border-brand-caramel shadow-soft"
            />
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedStatus(f.id)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all ${
              selectedStatus === f.id
                ? 'bg-brand-chocolate text-brand-cream shadow-soft'
                : 'bg-white border border-[#E7DFD6] text-brand-taupe hover:text-brand-chocolate'
            }`}
          >
            {lang === 'bn' ? f.labelBn : f.labelEn}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center text-brand-taupe text-sm">
          Loading orders...
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-[#E7DFD6] p-12 text-center shadow-soft space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-brand-caramel" />
          <p className="text-sm font-semibold text-brand-chocolate">{loadError}</p>
          <button
            onClick={() => { setLoading(true); setLoadError(null); fetchOrders(); }}
            className="inline-flex items-center gap-1.5 bg-brand-chocolate text-white px-4 py-2 rounded-xl text-sm font-bold shadow-soft"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try again'}</span>
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E7DFD6] p-12 text-center text-brand-taupe shadow-soft">
          <p className="text-sm font-semibold">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const waMsg = encodeURIComponent(`Salam ${ord.customer_name}! This is Sweet Cravings regarding your order #${ord.public_code}.`);
            const waLink = `https://wa.me/${ord.customer_phone.replace(/\D/g, '')}?text=${waMsg}`;
            const latestPendingSubmission = getLatestPendingSubmission(ord);
            const payNotifyUrl = generatePaymentNotReceivedUrl(ord);
            const isUpdating = updatingId === ord.id;

            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-[#E7DFD6] shadow-soft p-5 space-y-4 hover:border-brand-caramel/40 transition-colors"
              >
                {/* Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E7DFD6] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-brand-chocolate">
                      #{ord.public_code}
                    </span>
                    <span className="text-sm text-brand-taupe font-mono">
                      {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Order Status Badge */}
                    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      ord.order_status === 'new'
                        ? 'bg-brand-cream text-brand-caramel border border-[#E7DFD6]'
                        : ord.order_status === 'draft'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : ord.order_status === 'completed'
                        ? 'bg-brand-forest/10 text-brand-forest border border-brand-forest/25'
                        : ord.order_status === 'cancelled'
                        ? 'bg-brand-caramel/10 text-brand-chocolate border border-brand-chocolate/20'
                        : 'bg-brand-cream text-brand-chocolate border border-[#E7DFD6]'
                    }`}>
                      {ord.order_status === 'draft'
                        ? (lang === 'bn' ? 'সংরক্ষিত' : 'Saved')
                        : ord.order_status.replace(/_/g, ' ')}
                    </span>

                    {/* Payment Status Badge */}
                    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      ord.payment_status === 'confirmed'
                        ? 'bg-brand-forest/10 text-brand-forest border border-brand-forest/25'
                        : ord.payment_status === 'submitted'
                        ? 'bg-brand-cream text-brand-caramel border border-[#E7DFD6]'
                        : ord.payment_status === 'rejected'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-brand-cream text-brand-taupe'
                    }`}>
                      {ord.payment_method.toUpperCase()} • {ord.payment_status}
                    </span>
                  </div>
                </div>

                {/* Saved draft: not an order yet — no TrxID, no payment
                    to verify. The customer finishes it with the TrxID,
                    or the admin cancels it. */}
                {ord.order_status === 'draft' && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed">
                    <span className="font-bold">
                      {lang === 'bn' ? 'সংরক্ষিত — এখনো সাবমিট হয়নি। ' : 'Saved — not submitted yet. '}
                    </span>
                    <span>
                      {lang === 'bn'
                        ? 'কাস্টমার এখনো পেমেন্ট করেননি। TrxID পাঠালে অর্ডারটি জমা হবে।'
                        : 'The customer has not paid yet. The order is submitted once they send the TrxID.'}
                    </span>
                  </div>
                )}

                {/* Customer & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-brand-chocolate">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-brand-chocolate">{ord.customer_name}</p>
                      {ord.completed_orders_count !== undefined && (
                        ord.completed_orders_count >= 5 ? (
                          <span className="text-sm font-bold bg-brand-caramel/20 text-brand-caramel px-2 py-0.5 rounded-full border border-brand-caramel/30 flex items-center gap-0.5">
                            👑 VIP ({ord.completed_orders_count} orders)
                          </span>
                        ) : ord.completed_orders_count > 0 ? (
                          <span className="text-sm font-semibold bg-brand-cream text-brand-chocolate px-2 py-0.5 rounded-full border border-[#E7DFD6]">
                            ⭐ {ord.completed_orders_count} orders
                          </span>
                        ) : (
                          <span className="text-sm font-medium bg-brand-forest/10 text-brand-forest px-1.5 py-0.5 rounded-full">
                            🌱 1st Order
                          </span>
                        )
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-brand-taupe mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-brand-taupe/60" />
                      <span>{ord.customer_phone}</span>
                    </p>
                    {ord.requested_time && (
                      <p className="flex items-center gap-1 text-brand-caramel font-semibold mt-1">
                        <Clock className="w-3.5 h-3.5 text-brand-caramel" />
                        <span>Requested Time: {ord.requested_time}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-taupe/60 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-brand-chocolate">{ord.area_landmark}</strong>, {ord.delivery_address}
                      </span>
                    </p>
                    {ord.delivery_instructions && (
                      <p className="text-brand-taupe mt-1">
                        Note: {ord.delivery_instructions}
                      </p>
                    )}
                  </div>

                  {/* Gift Order Details */}
                  {Boolean(ord.is_gift) && (
                    <div className="sm:col-span-2 bg-gradient-to-r from-brand-caramel/10 via-brand-cream to-brand-cream border border-brand-caramel/30 rounded-xl p-3 text-sm space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-brand-caramel font-bold">
                          <Gift className="w-4 h-4 text-brand-caramel" />
                          <span>🎁 SURPRISE GIFT ORDER</span>
                        </div>
                        <span className="text-sm bg-brand-caramel/20 text-brand-caramel px-2 py-0.5 rounded-full font-semibold">
                          Complimentary Luxury Ribbon & Note
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-brand-chocolate">
                        <div>
                          <span className="text-brand-taupe">Deliver to Recipient:</span>{' '}
                          <strong>{ord.recipient_name || 'N/A'}</strong> ({ord.recipient_phone || 'N/A'})
                        </div>
                        <div>
                          <span className="text-brand-taupe">Ordered by:</span>{' '}
                          <strong>{ord.customer_name}</strong> ({ord.customer_phone})
                        </div>
                      </div>
                      {ord.gift_message && (
                        <div className="bg-white/80 rounded-lg p-2.5 border border-brand-caramel/25 text-brand-chocolate font-serif text-sm leading-relaxed">
                          &ldquo;{ord.gift_message}&rdquo;
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Items snapshot */}
                <div className="bg-brand-cream/50 rounded-xl p-3 text-sm space-y-1.5 border border-[#E7DFD6]">
                  {ord.items?.map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-brand-chocolate">
                      <span>
                        {it.quantity} × <strong>{it.product_name_en}</strong>
                        {it.variant_label_en ? ` (${it.variant_label_en})` : ''}
                      </span>
                      <span className="font-mono font-bold">৳{it.line_total}</span>
                    </div>
                  ))}
                  {ord.discount_amount && ord.discount_amount > 0 ? (
                    <div className="flex justify-between items-center text-brand-forest">
                      <span>Promo Discount ({ord.coupon_code || 'Coupon'}):</span>
                      <span className="font-mono font-bold">-৳{ord.discount_amount}</span>
                    </div>
                  ) : null}
                  <div className="border-t border-[#E7DFD6] pt-1.5 flex justify-between font-bold text-brand-chocolate text-sm">
                    <span>Total (incl. delivery ৳{ord.delivery_fee}):</span>
                    <span className="text-brand-caramel text-sm font-mono font-extrabold">৳{ord.total_amount}</span>
                  </div>
                </div>

                {/* TrxID if submitted */}
                {ord.payment_submissions && ord.payment_submissions.length > 0 && (
                  <div className="bg-brand-cream/90 border border-[#E7DFD6] p-2.5 rounded-xl text-sm space-y-1">
                    <span className="font-bold text-brand-chocolate block">Customer Submitted TrxID:</span>
                    {ord.payment_submissions.map((sub) => {
                      const duplicateOthers = getDuplicateOrderCodes(sub.transaction_ref, ord.public_code);
                      return (
                      <div key={sub.id} className="space-y-0.5">
                        <div className="flex justify-between font-mono text-sm text-brand-chocolate">
                          <span>TrxID: <strong>{sub.transaction_ref}</strong> ({sub.provider})</span>
                          <span className="capitalize text-brand-caramel font-bold">{sub.review_state}</span>
                        </div>
                        {sub.sender_number && (
                          <p className="text-[13px] text-brand-taupe">
                            {lang === 'bn' ? 'প্রেরক নম্বর:' : 'From:'} <span className="font-mono font-bold text-brand-chocolate">{sub.sender_number}</span>
                          </p>
                        )}
                        {duplicateOthers.length > 0 && (
                          <p className="flex items-center gap-1 text-[13px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {lang === 'bn'
                                ? `ডুপ্লিকেট TrxID — অর্ডার #${duplicateOthers.join(', #')} -এও ব্যবহার হয়েছে`
                                : `Duplicate TrxID — also used on order #${duplicateOthers.join(', #')}`}
                            </span>
                          </p>
                        )}
                        {sub.review_state === 'rejected' && (
                          <p className="flex items-center gap-1 text-[13px] text-brand-taupe">
                            <MessageSquare className="w-3.5 h-3.5 text-brand-forest shrink-0" />
                            <span>{lang === 'bn' ? 'কাস্টমারকে হোয়াটসঅ্যাপে জানানো হয়েছে — পেমেন্ট পাওয়া যায়নি' : 'Customer notified on WhatsApp — payment not received'}</span>
                          </p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Action Controls for Sister / Admin */}
                <div className="border-t border-[#E7DFD6] pt-3 flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Direct Contact Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${ord.customer_phone}`}
                      className="inline-flex items-center gap-1.5 bg-brand-cream hover:bg-brand-cream text-brand-chocolate border border-[#E7DFD6] px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-brand-taupe" />
                      <span>{t('admin.actionCall')}</span>
                    </a>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-brand-forest/10 hover:bg-brand-forest/15 text-brand-forest border border-brand-forest/25 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-brand-forest" />
                      <span>{t('admin.actionWhatsApp')}</span>
                    </a>
                    <a
                      href={generateRiderWhatsAppUrl(ord)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-brand-caramel/10 hover:bg-brand-caramel/20 text-brand-caramel border border-brand-caramel/30 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                      title="Send dispatch slip to delivery rider via WhatsApp"
                    >
                      <Bike className="w-3.5 h-3.5 text-brand-caramel" />
                      <span>Rider Slip</span>
                    </a>
                  </div>

                  {/* Status Advance & Payment Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* If new -> Accept Order */}
                    {ord.order_status === 'new' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, 'accepted', undefined, 'Order confirmed by kitchen')}
                        className="bg-brand-forest hover:bg-brand-chocolate text-white px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all shadow-soft"
                      >
                        Accept Order
                      </button>
                    )}

                    {/* If accepted -> Start Preparing */}
                    {ord.order_status === 'accepted' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, 'preparing', undefined, 'Baking started')}
                        className="bg-brand-chocolate hover:bg-brand-chocolate text-white px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all shadow-soft flex items-center gap-1"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Start Baking</span>
                      </button>
                    )}

                    {/* If preparing -> Ready */}
                    {ord.order_status === 'preparing' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, 'ready', undefined, 'Dessert packed & ready')}
                        className="bg-brand-chocolate hover:bg-brand-chocolate text-brand-cream px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all shadow-soft flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {/* If ready -> Out for Delivery */}
                    {ord.order_status === 'ready' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, 'out_for_delivery', undefined, 'Handed to delivery partner')}
                        className="bg-brand-chocolate hover:bg-brand-chocolate text-white px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all shadow-soft flex items-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Dispatch for Delivery</span>
                      </button>
                    )}

                    {/* If out_for_delivery -> Completed */}
                    {ord.order_status === 'out_for_delivery' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, 'completed', ord.payment_method === 'cod' ? 'confirmed' : undefined, 'Delivered & fulfilled')}
                        className="bg-brand-forest hover:bg-brand-chocolate text-white px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all shadow-soft flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Delivered</span>
                      </button>
                    )}

                    {/* Payment verification for bKash/Nagad — never for
                        drafts: there is no TrxID to confirm yet. */}
                    {(ord.payment_method === 'bkash' || ord.payment_method === 'nagad') && ord.order_status !== 'draft' && ord.payment_status !== 'confirmed' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, undefined, 'confirmed', 'Admin confirmed wallet receipt')}
                        className="bg-brand-forest/10 hover:bg-brand-forest/20 text-brand-forest border border-brand-forest/25 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                      >
                        ✓ Confirm Payment
                      </button>
                    )}

                    {/* Payment not received — notify customer on WhatsApp.
                        Only while a TrxID is submitted and unreviewed; the
                        link opens WhatsApp with the message prefilled, and
                        the click records the notice (payment_status ->
                        'rejected') so the sister can see she already asked.
                        Confirm Payment above keeps showing afterwards. */}
                    {(ord.payment_method === 'bkash' || ord.payment_method === 'nagad') &&
                      ord.payment_status === 'submitted' && latestPendingSubmission && (
                      <a
                        href={payNotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handlePaymentNotReceived(ord)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-1.5"
                        title={lang === 'bn' ? 'কাস্টমারকে হোয়াটসঅ্যাপে জানান — পেমেন্ট পাওয়া যায়নি' : 'Notify customer on WhatsApp — payment not received'}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'পেমেন্ট পাওয়া যায়নি' : 'Payment not received'}</span>
                      </a>
                    )}

                    {/* Cancel order button if not already completed/cancelled */}
                    {ord.order_status !== 'completed' && ord.order_status !== 'cancelled' && (
                      <button
                        disabled={isUpdating}
                        onClick={async () => {
                          const reason = await confirm({
                            title: 'Cancel this order?',
                            message: 'This marks the order cancelled. It cannot be undone.',
                            confirmLabel: 'Cancel order',
                            destructive: true,
                            input: { label: 'Cancellation reason', placeholder: 'e.g. Customer asked to cancel', required: true },
                          });
                          if (typeof reason === 'string' && reason.trim()) {
                            handleUpdateStatus(ord.id, 'cancelled', undefined, `Cancelled: ${reason.trim()}`);
                          }
                        }}
                        className="text-brand-taupe/60 hover:text-brand-chocolate p-1.5 rounded text-sm transition-colors"
                        title="Cancel Order"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <React.Suspense fallback={<div className="py-20 text-center text-brand-taupe text-sm">Loading admin dashboard...</div>}>
      <AdminOrdersContent />
    </React.Suspense>
  );
}
