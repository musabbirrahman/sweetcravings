'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { 
  Bell, 
  ShoppingBag, 
  Coffee, 
  Settings, 
  LogOut, 
  AlertTriangle, 
  CheckCircle,
  ExternalLink
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useLanguage();

  const [isStorePaused, setIsStorePaused] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!isLoginPage) {
      fetch('/api/products')
        .then((r) => r.json())
        .then((data) => {
          if (data.settings) {
            setIsStorePaused(!!data.settings.is_store_paused);
          }
        })
        .catch(() => {});
    }
  }, [isLoginPage]);

  const handleTogglePause = async () => {
    setLoadingStatus(true);
    const newStatus = !isStorePaused;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { is_store_paused: newStatus ? 'true' : 'false' },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsStorePaused(newStatus);
      }
    } catch {
      alert('Failed to update kitchen status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  const tabs = [
    { href: '/admin', label: t('admin.tabDashboard'), icon: Bell },
    { href: '/admin/orders', label: t('admin.tabOrders'), icon: ShoppingBag },
    { href: '/admin/products', label: t('admin.tabProducts'), icon: Coffee },
    { href: '/admin/settings', label: t('admin.tabSettings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col font-sans">
      
      {/* Top Admin Bar */}
      <header className="bg-brand-chocolate-dark text-white sticky top-0 z-40 border-b border-brand-chocolate shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-full overflow-hidden border border-brand-cream-dark/30 shrink-0 bg-brand-cream">
              <Image src="/sweet-cravings-logo.jpg" alt="Sweet Cravings" fill className="object-cover" />
            </div>
            <div>
              <span className="font-heading font-bold text-base text-brand-gold-light tracking-tight block">
                Sweet Cravings Admin
              </span>
              <span className="text-[10px] text-brand-cream-dark/70 font-medium block">
                {lang === 'bn' ? 'অপারেটর প্যানেল • রাজশাহী' : 'Operator Panel • Rajshahi'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Kitchen Status Emergency Toggle */}
            <button
              onClick={handleTogglePause}
              disabled={loadingStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                isStorePaused
                  ? 'bg-[#9C5A2B] hover:bg-[#854B20] text-white animate-pulse'
                  : 'bg-brand-forest hover:bg-[#1E4330] text-white'
              }`}
              title="Click to toggle kitchen order acceptance"
            >
              {isStorePaused ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {isStorePaused ? t('admin.storePaused') : t('admin.storeActive')}
              </span>
            </button>

            {/* View storefront link */}
            <Link
              href="/"
              target="_blank"
              className="hidden sm:flex items-center gap-1 text-xs text-brand-gold-light/90 hover:text-white px-2 py-1 rounded transition-colors"
            >
              <span>Storefront</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              onClick={handleLogout}
              className="p-1.5 text-brand-cream-dark/80 hover:text-white hover:bg-brand-chocolate rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 overflow-x-auto scrollbar-none border-t border-brand-chocolate">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-brand-gold text-brand-gold-light bg-brand-chocolate/40'
                    : 'border-transparent text-brand-cream-dark/70 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full">
        {children}
      </main>

    </div>
  );
}
