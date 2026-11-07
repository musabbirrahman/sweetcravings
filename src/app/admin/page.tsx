'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Order } from '@/lib/types';
import { 
  Bell, 
  CreditCard, 
  ChefHat, 
  CheckCircle, 
  ArrowRight, 
  Phone
} from 'lucide-react';

export default function AdminTodayDashboard() {
  const { lang, t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setOrders(data.orders || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const newOrders = orders.filter((o) => o.order_status === 'new');
  const pendingPayments = orders.filter(
    (o) => (o.payment_method === 'bkash' || o.payment_method === 'nagad') && o.payment_status === 'submitted'
  );
  const activePreparing = orders.filter(
    (o) => o.order_status === 'accepted' || o.order_status === 'preparing' || o.order_status === 'ready'
  );

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-cream-dark shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            {t('admin.portalTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-brand-taupe mt-0.5">
            {t('admin.sisterGreeting')}
          </p>
        </div>

        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 bg-brand-caramel hover:bg-brand-caramel-dark text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-soft transition-all self-start sm:self-auto"
        >
          <span>{lang === 'bn' ? 'সকল অর্ডার দেখুন' : 'View All Orders'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Urgent Attention Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* New Orders Card */}
        <Link
          href="/admin/orders?status=new"
          className={`p-5 rounded-2xl border transition-all shadow-soft flex items-center justify-between ${
            newOrders.length > 0 
              ? 'bg-brand-vanilla border-brand-caramel/40 ring-1 ring-brand-caramel/20' 
              : 'bg-white border-brand-cream-dark'
          }`}
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-taupe">
              {t('admin.newOrdersAlert')}
            </span>
            <div className="text-3xl font-bold text-brand-caramel mt-1 font-heading">
              {newOrders.length}
            </div>
            <p className="text-[11px] text-brand-taupe mt-0.5">
              {newOrders.length > 0 ? (lang === 'bn' ? 'রিভিউ ও গ্রহণ করুন' : 'Review & accept') : (lang === 'bn' ? 'সব ক্লিয়ার!' : 'All clear')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-cream-subtle flex items-center justify-center text-brand-caramel">
            <Bell className="w-6 h-6" />
          </div>
        </Link>

        {/* Pending Payments Card */}
        <Link
          href="/admin/orders?payment=submitted"
          className={`p-5 rounded-2xl border transition-all shadow-soft flex items-center justify-between ${
            pendingPayments.length > 0
              ? 'bg-brand-strawberry-light border-brand-strawberry/30 ring-1 ring-brand-strawberry/20'
              : 'bg-white border-brand-cream-dark'
          }`}
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-taupe">
              {t('admin.pendingPaymentsAlert')}
            </span>
            <div className="text-3xl font-bold text-brand-strawberry mt-1 font-heading">
              {pendingPayments.length}
            </div>
            <p className="text-[11px] text-brand-taupe mt-0.5">
              {pendingPayments.length > 0 ? (lang === 'bn' ? 'বিকাশ/নগদ TrxID যাচাই করুন' : 'Verify bKash/Nagad TrxID') : (lang === 'bn' ? 'পেমেন্ট ক্লিয়ার' : 'Payments verified')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-strawberry-light flex items-center justify-center text-brand-strawberry">
            <CreditCard className="w-6 h-6" />
          </div>
        </Link>

        {/* Active Preparing Orders */}
        <Link
          href="/admin/orders?status=active"
          className="bg-white p-5 rounded-2xl border border-brand-cream-dark shadow-soft flex items-center justify-between"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-taupe">
              {lang === 'bn' ? 'কিচেনে চলমান' : 'Active in Kitchen'}
            </span>
            <div className="text-3xl font-bold text-brand-chocolate mt-1 font-heading">
              {activePreparing.length}
            </div>
            <p className="text-[11px] text-brand-taupe mt-0.5">
              {lang === 'bn' ? 'প্রস্তুতি ও ডেলিভারি চলছে' : 'Baking & In Transit'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-cream-subtle flex items-center justify-center text-brand-taupe">
            <ChefHat className="w-6 h-6" />
          </div>
        </Link>

      </div>

      {/* Orders Needing Immediate Attention */}
      <div className="bg-white rounded-2xl border border-brand-cream-dark shadow-soft p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-brand-cream-dark pb-3">
          <h2 className="font-heading font-bold text-lg text-brand-chocolate">
            {lang === 'bn' ? 'জরুরি দৃষ্টি প্রয়োজন এমন অর্ডারসমূহ' : 'Orders Needing Attention'}
          </h2>
          <span className="text-xs bg-brand-cream-subtle text-brand-taupe px-2.5 py-1 rounded-full font-semibold">
            {newOrders.length + pendingPayments.length} Pending
          </span>
        </div>

        {newOrders.length === 0 && pendingPayments.length === 0 ? (
          <div className="text-center py-12 text-brand-taupe space-y-2">
            <CheckCircle className="w-10 h-10 mx-auto text-brand-forest stroke-[1.5]" />
            <p className="text-sm font-semibold text-brand-chocolate">
              {lang === 'bn' ? 'এই মুহূর্তে জরুরি কোনো পেন্ডিং অর্ডার নেই!' : 'No urgent pending orders right now!'}
            </p>
            <p className="text-xs text-brand-taupe">
              {lang === 'bn' ? 'নতুন কোনো অর্ডার আসলে এখানে সবার উপরে প্রদর্শিত হবে।' : 'New orders will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...newOrders, ...pendingPayments.filter(p => !newOrders.some(n => n.id === p.id))].map((ord) => (
              <div
                key={ord.id}
                className="bg-brand-cream-subtle/50 border border-brand-cream-dark rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-cream-subtle transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-brand-chocolate">#{ord.public_code}</span>
                    <span className="bg-brand-vanilla text-brand-caramel text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-brand-cream-dark">
                      {ord.order_status}
                    </span>
                    <span className="bg-brand-cream text-brand-chocolate text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-brand-cream-dark">
                      {ord.payment_method}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-brand-chocolate mt-1">
                    {ord.customer_name} • {ord.area_landmark} • ৳{ord.total_amount}
                  </p>
                  <p className="text-[11px] text-brand-taupe mt-0.5">
                    Phone: {ord.customer_phone} {ord.requested_time ? `• Preferred: ${ord.requested_time}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${ord.customer_phone}`}
                    className="flex items-center gap-1 bg-white border border-brand-cream-dark px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-chocolate hover:bg-brand-cream-subtle transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                  <Link
                    href={`/admin/orders?search=${ord.public_code}`}
                    className="flex items-center gap-1 bg-brand-caramel hover:bg-brand-caramel-dark text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-soft transition-colors"
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

    </div>
  );
}
