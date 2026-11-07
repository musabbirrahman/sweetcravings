'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { Order, OrderStatus, PaymentStatus } from '@/lib/types';
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
  Bike
} from 'lucide-react';

const STATUS_FILTERS = [
  { id: 'all', labelEn: 'All', labelBn: 'সকল' },
  { id: 'new', labelEn: 'New', labelBn: 'নতুন' },
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
  const initialStatus = searchParams.get('status') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchOrders = () => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setOrders(data.orders || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
        alert(data.error || 'Failed to update order');
      }
    } catch {
      alert('Error updating order');
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
Sweet Cravings Kitchen: +8801712345678`;

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
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

  return (
    <div className="space-y-6">
      
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            {t('admin.tabOrders')}
          </h1>
          <p className="text-xs text-brand-taupe">
            {orders.length} total orders recorded in Sweet Cravings database
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code, name, phone..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-cream-dark bg-white text-xs focus:outline-none focus:border-brand-caramel shadow-soft"
          />
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedStatus(f.id)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedStatus === f.id
                ? 'bg-brand-chocolate text-brand-gold-light shadow-soft'
                : 'bg-white border border-brand-cream-dark text-brand-taupe hover:text-brand-chocolate'
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
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-brand-cream-dark p-12 text-center text-brand-taupe shadow-soft">
          <p className="text-sm font-semibold">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((ord) => {
            const waMsg = encodeURIComponent(`Salam ${ord.customer_name}! This is Sweet Cravings regarding your order #${ord.public_code}.`);
            const waLink = `https://wa.me/${ord.customer_phone.replace(/\D/g, '')}?text=${waMsg}`;
            const isUpdating = updatingId === ord.id;

            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-brand-cream-dark shadow-soft p-5 space-y-4 hover:border-brand-caramel/40 transition-colors"
              >
                {/* Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-cream-dark pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-brand-chocolate">
                      #{ord.public_code}
                    </span>
                    <span className="text-[11px] text-brand-taupe font-mono">
                      {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Order Status Badge */}
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      ord.order_status === 'new'
                        ? 'bg-brand-vanilla text-brand-caramel border border-brand-cream-dark'
                        : ord.order_status === 'completed'
                        ? 'bg-brand-forest-light text-brand-forest border border-brand-forest-border'
                        : ord.order_status === 'cancelled'
                        ? 'bg-brand-strawberry-light text-brand-strawberry border border-brand-strawberry/20'
                        : 'bg-brand-cream-subtle text-brand-chocolate border border-brand-cream-dark'
                    }`}>
                      {ord.order_status.replace(/_/g, ' ')}
                    </span>

                    {/* Payment Status Badge */}
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      ord.payment_status === 'confirmed'
                        ? 'bg-brand-forest-light text-brand-forest border border-brand-forest-border'
                        : ord.payment_status === 'submitted'
                        ? 'bg-brand-vanilla text-brand-caramel border border-brand-cream-dark'
                        : 'bg-brand-cream-subtle text-brand-taupe'
                    }`}>
                      {ord.payment_method.toUpperCase()} • {ord.payment_status}
                    </span>
                  </div>
                </div>

                {/* Customer & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-brand-chocolate">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-brand-chocolate">{ord.customer_name}</p>
                      {ord.completed_orders_count !== undefined && (
                        ord.completed_orders_count >= 5 ? (
                          <span className="text-[10px] font-bold bg-brand-caramel/20 text-brand-caramel px-2 py-0.5 rounded-full border border-brand-caramel/30 flex items-center gap-0.5">
                            👑 VIP ({ord.completed_orders_count} orders)
                          </span>
                        ) : ord.completed_orders_count > 0 ? (
                          <span className="text-[10px] font-semibold bg-brand-cream-subtle text-brand-chocolate px-2 py-0.5 rounded-full border border-brand-cream-dark">
                            ⭐ {ord.completed_orders_count} orders
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium bg-brand-forest-light text-brand-forest px-1.5 py-0.5 rounded-full">
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
                      <p className="text-brand-taupe italic mt-1">
                        Note: {ord.delivery_instructions}
                      </p>
                    )}
                  </div>

                  {/* Gift Order Details */}
                  {Boolean(ord.is_gift) && (
                    <div className="sm:col-span-2 bg-gradient-to-r from-brand-caramel/10 via-brand-vanilla to-brand-cream-subtle border border-brand-caramel/30 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-brand-caramel font-bold">
                          <Gift className="w-4 h-4 text-brand-caramel" />
                          <span>🎁 SURPRISE GIFT ORDER</span>
                        </div>
                        <span className="text-[10px] bg-brand-caramel/20 text-brand-caramel px-2 py-0.5 rounded-full font-semibold">
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
                        <div className="bg-white/80 rounded-lg p-2.5 border border-brand-caramel/25 text-brand-chocolate italic font-serif text-[13px] leading-relaxed">
                          &ldquo;{ord.gift_message}&rdquo;
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Items snapshot */}
                <div className="bg-brand-cream-subtle/50 rounded-xl p-3 text-xs space-y-1.5 border border-brand-cream-dark">
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
                  <div className="border-t border-brand-cream-dark pt-1.5 flex justify-between font-bold text-brand-chocolate text-xs">
                    <span>Total (incl. delivery ৳{ord.delivery_fee}):</span>
                    <span className="text-brand-caramel text-sm font-mono font-extrabold">৳{ord.total_amount}</span>
                  </div>
                </div>

                {/* TrxID if submitted */}
                {ord.payment_submissions && ord.payment_submissions.length > 0 && (
                  <div className="bg-brand-vanilla/90 border border-brand-cream-dark p-2.5 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-brand-chocolate block">Customer Submitted TrxID:</span>
                    {ord.payment_submissions.map((sub) => (
                      <div key={sub.id} className="flex justify-between font-mono text-[11px] text-brand-chocolate">
                        <span>TrxID: <strong>{sub.transaction_ref}</strong> ({sub.provider})</span>
                        <span className="capitalize text-brand-caramel font-bold">{sub.review_state}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Controls for Sister / Admin */}
                <div className="border-t border-brand-cream-dark pt-3 flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Direct Contact Buttons */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${ord.customer_phone}`}
                      className="inline-flex items-center gap-1.5 bg-brand-cream-subtle hover:bg-brand-cream text-brand-chocolate border border-brand-cream-dark px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-brand-taupe" />
                      <span>{t('admin.actionCall')}</span>
                    </a>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-brand-forest-light hover:bg-brand-forest/15 text-brand-forest border border-brand-forest-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-brand-forest" />
                      <span>{t('admin.actionWhatsApp')}</span>
                    </a>
                    <a
                      href={generateRiderWhatsAppUrl(ord)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-brand-caramel/10 hover:bg-brand-caramel/20 text-brand-caramel border border-brand-caramel/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
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
                        className="bg-brand-forest hover:bg-[#1E4330] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-soft"
                      >
                        Accept Order
                      </button>
                    )}

                    {/* If accepted -> Start Preparing */}
                    {ord.order_status === 'accepted' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, 'preparing', undefined, 'Baking started')}
                        className="bg-brand-caramel hover:bg-brand-caramel-dark text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-soft flex items-center gap-1"
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
                        className="bg-brand-chocolate hover:bg-brand-chocolate-light text-brand-gold-light px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-soft flex items-center gap-1"
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
                        className="bg-brand-caramel hover:bg-brand-caramel-dark text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-soft flex items-center gap-1"
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
                        className="bg-brand-forest hover:bg-[#1E4330] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-soft flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Delivered</span>
                      </button>
                    )}

                    {/* Payment verification for bKash/Nagad */}
                    {(ord.payment_method === 'bkash' || ord.payment_method === 'nagad') && ord.payment_status !== 'confirmed' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(ord.id, undefined, 'confirmed', 'Admin confirmed wallet receipt')}
                        className="bg-brand-forest-light hover:bg-brand-forest/20 text-brand-forest border border-brand-forest-border px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        ✓ Confirm Payment
                      </button>
                    )}

                    {/* Cancel order button if not already completed/cancelled */}
                    {ord.order_status !== 'completed' && ord.order_status !== 'cancelled' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => {
                          const reason = prompt('Please enter cancellation reason:');
                          if (reason) {
                            handleUpdateStatus(ord.id, 'cancelled', undefined, `Cancelled: ${reason}`);
                          }
                        }}
                        className="text-brand-taupe/60 hover:text-brand-strawberry p-1.5 rounded text-xs transition-colors"
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
