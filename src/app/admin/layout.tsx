'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/components/DialogProvider';
import { 
  Bell, 
  ShoppingBag, 
  Coffee, 
  Tags,
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
  const { settings } = useCatalog();

  const [isStorePaused, setIsStorePaused] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const toast = useToast();
  const isLoginPage = pathname === '/admin/login';

  // Store-paused flag comes from the shared catalogue (fetched once per
  // page load) instead of a second /api/products call.
  useEffect(() => {
    if (!isLoginPage && settings) {
      setIsStorePaused(!!settings.is_store_paused);
    }
  }, [isLoginPage, settings]);

  // On mobile the tab strip scrolls horizontally: keep the active tab
  // visible instead of leaving it cut off past the edge.
  useEffect(() => {
    document
      .querySelector('[data-active-tab="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

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
      toast('Failed to update kitchen status', 'error');
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
    { href: '/admin/categories', label: t('admin.tabCategories'), icon: Tags },
    { href: '/admin/settings', label: t('admin.tabSettings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col font-sans">
      
      {/* Top Admin Bar */}
      <header className="bg-brand-chocolate text-white sticky top-0 z-40 border-b border-brand-chocolate shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-full overflow-hidden border border-[#E7DFD6] shrink-0 bg-brand-cream">
              <Image src="/sweet-cravings-logo.jpg" alt="Sweet Cravings" width={72} height={72} className="object-cover w-full h-full" />
            </div>
            <div>
              <span className="font-heading font-bold text-base text-brand-cream tracking-tight block">
                Sweet Cravings Admin
              </span>
              <span className="text-sm text-brand-cream/70 font-medium block">
                {lang === 'bn' ? 'অপারেটর প্যানেল • রাজশাহী' : 'Operator Panel • Rajshahi'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Kitchen Status Emergency Toggle */}
            <button
              onClick={handleTogglePause}
              disabled={loadingStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm ${
                isStorePaused
                  ? 'bg-brand-chocolate hover:bg-brand-chocolate text-white animate-pulse'
                  : 'bg-brand-forest hover:bg-brand-chocolate text-white'
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
              className="hidden sm:flex items-center gap-1 text-sm text-brand-cream/90 hover:text-white px-2 py-1 rounded transition-colors"
            >
              <span>{lang === 'bn' ? 'দোকান' : 'Storefront'}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              onClick={handleLogout}
              className="p-1.5 text-brand-cream/80 hover:text-white hover:bg-brand-chocolate rounded-lg transition-colors"
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
                data-active-tab={isActive ? 'true' : undefined}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-brand-caramel text-brand-cream bg-brand-chocolate/40'
                    : 'border-transparent text-brand-cream/70 hover:text-white'
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
