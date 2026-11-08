'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { fetchAdminJson } from '@/lib/adminFetch';
import { Order } from '@/lib/types';
import { 
  Bell, 
  CreditCard, 
  ChefHat, 
  CheckCircle, 
  ArrowRight, 
  Phone,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export default function AdminTodayDashboard() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Same rules as the orders list: always fresh, 401 goes visibly to the
  // login page, other failures show an error — never a fake "All clear".
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="py-20 text-center text-brand-taupe text-sm">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
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
      </div>
    );
  }

  const newOrders = orders.filter((o) => o.order_status === 'new');
  const pendingPayments = orders.filter(
    (o) => (o.payment_method === 'bkash' || o.payment_method === 'nagad') && o.payment_status === 'submitted'
  );
  const activePreparing = orders.filter(
    (o) => o.order_status === 'accepted' || o.order_status === 'preparing' || o.order_status === 'ready'
  );
  // Saved drafts are not orders yet: they never appear in the counts
  // above, but the sister can see them here until the customer finishes
  // them with the TrxID (or the admin cancels them).
  const draftOrders = orders.filter((o) => o.order_status === 'draft');

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E7DFD6] shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            {t('admin.portalTitle')}
          </h1>
          <p className="text-sm sm:text-sm text-brand-taupe mt-0.5">
            {t('admin.sisterGreeting')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 bg-white border border-[#E7DFD6] text-brand-chocolate text-sm font-bold py-2.5 px-4 rounded-xl shadow-soft transition-colors disabled:opacity-60"
            title={lang === 'bn' ? 'ড্যাশবোর্ড রিফ্রেশ করুন' : 'Refresh dashboard'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 bg-brand-chocolate hover:bg-brand-chocolate text-white text-sm font-bold py-2.5 px-4 rounded-xl shadow-soft transition-all"
          >
            <span>{lang === 'bn' ? 'সকল অর্ডার দেখুন' : 'View All Orders'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Urgent Attention Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* New Orders Card */}
        <Link
          href="/admin/orders?status=new"
          className={`p-5 rounded-2xl border transition-all shadow-soft flex items-center justify-between ${
            newOrders.length > 0 
              ? 'bg-brand-cream border-brand-caramel/40 ring-1 ring-brand-caramel/20' 
              : 'bg-white border-[#E7DFD6]'
          }`}
        >
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-brand-taupe">
              {t('admin.newOrdersAlert')}
            </span>
            <div className="text-3xl font-bold text-brand-caramel mt-1 font-heading">
              {newOrders.length}
            </div>
            <p className="text-sm text-brand-taupe mt-0.5">
              {newOrders.length > 0 ? (lang === 'bn' ? 'রিভিউ ও গ্রহণ করুন' : 'Review & accept') : (lang === 'bn' ? 'সব ক্লিয়ার!' : 'All clear')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-cream flex items-center justify-center text-brand-caramel">
            <Bell className="w-6 h-6" />
          </div>
        </Link>

        {/* Pending Payments Card */}
        <Link
          href="/admin/orders?payment=submitted"
          className={`p-5 rounded-2xl border transition-all shadow-soft flex items-center justify-between ${
            pendingPayments.length > 0
              ? 'bg-brand-caramel/10 border-brand-chocolate/30 ring-1 ring-brand-chocolate/20'
              : 'bg-white border-[#E7DFD6]'
          }`}
        >
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-brand-taupe">
              {t('admin.pendingPaymentsAlert')}
            </span>
            <div className="text-3xl font-bold text-brand-chocolate mt-1 font-heading">
              {pendingPayments.length}
            </div>
            <p className="text-sm text-brand-taupe mt-0.5">
              {pendingPayments.length > 0 ? (lang === 'bn' ? 'বিকাশ/নগদ TrxID যাচাই করুন' : 'Verify bKash/Nagad TrxID') : (lang === 'bn' ? 'পেমেন্ট ক্লিয়ার' : 'Payments verified')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-caramel/10 flex items-center justify-center text-brand-chocolate">
            <CreditCard className="w-6 h-6" />
          </div>
        </Link>

        {/* Active Preparing Orders */}
        <Link
          href="/admin/orders?status=active"
          className="bg-white p-5 rounded-2xl border border-[#E7DFD6] shadow-soft flex items-center justify-between"
        >
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-brand-taupe">
              {lang === 'bn' ? 'কিচেনে চলমান' : 'Active in Kitchen'}
            </span>
            <div className="text-3xl font-bold text-brand-chocolate mt-1 font-heading">
              {activePreparing.length}
            </div>
            <p className="text-sm text-brand-taupe mt-0.5">
              {lang === 'bn' ? 'প্রস্তুতি ও ডেলিভারি চলছে' : 'Baking & In Transit'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-cream flex items-center justify-center text-brand-taupe">
            <ChefHat className="w-6 h-6" />
          </div>
        </Link>

      </div>

      {/* Orders Needing Immediate Attention */}
      <div className="bg-white rounded-2xl border border-[#E7DFD6] shadow-soft p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7DFD6] pb-3">
          <h2 className="font-heading font-bold text-lg text-brand-chocolate">
            {lang === 'bn' ? 'জরুরি দৃষ্টি প্রয়োজন এমন অর্ডারসমূহ' : 'Orders Needing Attention'}
          </h2>
          <span className="text-sm bg-brand-cream text-brand-taupe px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
            {newOrders.length + pendingPayments.length} Pending
          </span>
        </div>

        {newOrders.length === 0 && pendingPayments.length === 0 ? (
          <div className="text-center py-12 text-brand-taupe space-y-2">
            <CheckCircle className="w-10 h-10 mx-auto text-brand-forest stroke-[1.5]" />
            <p className="text-sm font-semibold text-brand-chocolate">
              {lang === 'bn' ? 'এই মুহূর্তে জরুরি কোনো পেন্ডিং অর্ডার নেই!' : 'No urgent pending orders right now!'}
            </p>
            <p className="text-sm text-brand-taupe">
              {lang === 'bn' ? 'নতুন কোনো অর্ডার আসলে এখানে সবার উপরে প্রদর্শিত হবে।' : 'New orders will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...newOrders, ...pendingPayments.filter(p => !newOrders.some(n => n.id === p.id))].map((ord) => (
              <div
                key={ord.id}
                className="bg-brand-cream/50 border border-[#E7DFD6] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-cream transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-brand-chocolate">#{ord.public_code}</span>
                    <span className="bg-brand-cream text-brand-caramel text-sm font-bold px-2 py-0.5 rounded-full uppercase border border-[#E7DFD6]">
                      {ord.order_status}
                    </span>
                    <span className="bg-brand-cream text-brand-chocolate text-sm font-bold px-2 py-0.5 rounded-full uppercase border border-[#E7DFD6]">
                      {ord.payment_method}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-brand-chocolate mt-1">
                    {ord.customer_name} • {ord.area_landmark} • ৳{ord.total_amount}
                  </p>
                  <p className="text-sm text-brand-taupe mt-0.5">
                    Phone: {ord.customer_phone} {ord.requested_time ? `• Preferred: ${ord.requested_time}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${ord.customer_phone}`}
                    className="flex items-center gap-1 bg-white border border-[#E7DFD6] px-3 py-1.5 rounded-lg text-sm font-semibold text-brand-chocolate hover:bg-brand-cream transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                  <Link
                    href={`/admin/orders?search=${ord.public_code}`}
                    className="flex items-center gap-1 bg-brand-chocolate hover:bg-brand-chocolate text-white px-3.5 py-1.5 rounded-lg text-sm font-bold shadow-soft transition-colors"
                  >
                    <span>Manage Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved drafts — visible, but never counted as orders. The
          customer has not paid yet; the order only becomes real when
          they submit the TrxID. Drafts stay until completed or cancelled. */}
      {draftOrders.length > 0 && (
      <div className="bg-white rounded-2xl border border-amber-200 shadow-soft p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E7DFD6] pb-3">
          <h2 className="font-heading font-bold text-lg text-brand-chocolate">
            {lang === 'bn' ? 'সংরক্ষিত অর্ডার (এখনো সাবমিট হয়নি)' : 'Saved — not submitted yet'}
          </h2>
          <span className="text-sm bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap border border-amber-200">
            {draftOrders.length} {lang === 'bn' ? 'টি সংরক্ষিত' : 'saved'}
          </span>
        </div>
        <p className="text-sm text-brand-taupe">
          {lang === 'bn'
            ? 'এই অর্ডারগুলোর পেমেন্ট এখনো হয়নি। কাস্টমার TrxID পাঠালে অর্ডারটি জমা হবে; না হলে এখান থেকে বাতিল করা যাবে।'
            : 'These customers have not paid yet. The order is submitted once they send the TrxID; otherwise it can be cancelled from the orders list.'}
        </p>
        <div className="space-y-3">
          {draftOrders.map((ord) => (
            <div
              key={ord.id}
              className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-brand-chocolate">#{ord.public_code}</span>
                  <span className="bg-amber-50 text-amber-800 text-sm font-bold px-2 py-0.5 rounded-full uppercase border border-amber-200">
                    {lang === 'bn' ? 'সংরক্ষিত' : 'Saved'}
                  </span>
                  <span className="bg-brand-cream text-brand-chocolate text-sm font-bold px-2 py-0.5 rounded-full uppercase border border-[#E7DFD6]">
                    {ord.payment_method}
                  </span>
                </div>
                <p className="text-sm font-semibold text-brand-chocolate mt-1">
                  {ord.customer_name} • {ord.area_landmark} • ৳{ord.total_amount}
                </p>
                <p className="text-sm text-brand-taupe mt-0.5">
                  Phone: {ord.customer_phone} {ord.requested_time ? `• Preferred: ${ord.requested_time}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${ord.customer_phone}`}
                  className="flex items-center gap-1 bg-white border border-[#E7DFD6] px-3 py-1.5 rounded-lg text-sm font-semibold text-brand-chocolate hover:bg-brand-cream transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>
                <Link
                  href={`/admin/orders?search=${ord.public_code}`}
                  className="flex items-center gap-1 bg-brand-chocolate hover:bg-brand-chocolate text-white px-3.5 py-1.5 rounded-lg text-sm font-bold shadow-soft transition-colors"
                >
                  <span>Manage Order</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

    </div>
  );
}
