'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, Menu, X, Globe, Phone } from 'lucide-react';

export default function Navbar() {
  const { lang, setLang, toggleLang, t } = useLanguage();
  const { settings } = useCatalog();
  const { totalItemsCount, subtotal, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // WhatsApp number comes from the shared catalogue (fetched once per
  // page load); empty until the shop configures it.
  const phoneNum = settings?.whatsapp_number || '';

  // Hide customer navbar completely on operator admin portal pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/menu', label: t('nav.menu') },
    { href: '/about', label: t('nav.about') },
    { href: '/track', label: t('nav.track') },
    { href: '/contact', label: t('nav.contact') },
  ];

  return (
    <>
      {/* Top Announcement Bar: Ultra-clean, subtle luxury feel */}
      <div className="bg-brand-chocolate text-brand-cream text-[11px] font-medium py-2 px-4 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-brand-cream/95 tracking-wide">
              {lang === 'bn' 
                ? 'রাজশাহীতে তাজা ঘরে তৈরি প্রিমিয়াম ডেজার্ট ডেলিভারি চালু আছে' 
                : 'Artisanal Desserts Baking Daily • Rajshahi Citywide Delivery Active'}
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            {phoneNum && (
            <a 
              href={`https://wa.me/${phoneNum.replace(/\D/g, '').startsWith('88') ? phoneNum.replace(/\D/g, '') : '88' + phoneNum.replace(/\D/g, '')}?text=${encodeURIComponent('Salam! I have an inquiry about Sweet Cravings desserts.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-brand-cream/90 hover:text-white transition-colors"
            >
              <Phone className="w-3 h-3 text-emerald-400" />
              <span className="tracking-wide">{phoneNum}</span>
            </a>
            )}

            {/* Language Switcher Pill */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-full border border-white/10 text-brand-cream text-[11px] font-semibold transition-all btn-press"
              title="Change Language"
            >
              <Globe className="w-3 h-3 text-brand-cream" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation: Sticky Frosted Glass */}
      <header className="sticky top-0 z-40 glass-nav border-b border-brand-chocolate/10 shadow-soft transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          
          {/* Logo & Brand Title */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-brand-chocolate/10 shadow-sm group-hover:scale-105 transition-transform bg-white ring-2 ring-brand-caramel/10">
              <Image 
                src="/sweet-cravings-logo.jpg" 
                alt="Sweet Cravings Homemade Desserts" 
                width={96}
                height={96}
                className="object-cover w-full h-full"
                priority
              />
            </div>
            <div>
              <span className="font-heading text-xl sm:text-2xl font-bold text-brand-chocolate tracking-tight block leading-tight group-hover:text-brand-caramel transition-colors">
                Sweet Cravings
              </span>
              <span className="text-[10px] font-semibold text-brand-taupe tracking-widest uppercase block">
                {lang === 'bn' ? 'হোমমেড ডেজার্টস • রাজশাহী' : 'Homemade Desserts • Rajshahi'}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-brand-cream/50 p-1 rounded-full border border-brand-chocolate/10">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 ${
                    isActive 
                      ? 'bg-white text-brand-chocolate font-bold shadow-sm' 
                      : 'text-brand-taupe hover:text-brand-chocolate hover:bg-white/60'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs: Bag / Cart Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2.5 bg-brand-chocolate hover:bg-brand-chocolate text-brand-cream px-4 py-2.5 rounded-full shadow-card hover:shadow-card-hover transition-all duration-200 btn-press group"
              aria-label="View Shopping Cart"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-brand-cream group-hover:scale-110 transition-transform" />
                {totalItemsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-caramel text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-brand-chocolate animate-pulse">
                    {totalItemsCount}
                  </span>
                )}
              </div>
              <span className="font-heading font-bold text-xs tracking-wide">
                ৳{subtotal}
              </span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-brand-chocolate hover:bg-brand-cream rounded-xl transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu with frosted glass */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/98 backdrop-blur-xl border-b border-brand-chocolate/10 px-5 pt-3 pb-6 space-y-2 shadow-xl animate-fade-in-up">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive 
                        ? 'bg-brand-caramel/10 text-brand-caramel font-bold' 
                        : 'text-brand-chocolate hover:bg-brand-cream'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="pt-3 border-t border-brand-chocolate/10 flex items-center justify-between">
              <span className="text-xs text-brand-taupe font-medium">
                {lang === 'bn' ? 'ভাষা নির্বাচন করুন:' : 'Language:'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setLang('bn'); setMobileMenuOpen(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    lang === 'bn' ? 'bg-brand-chocolate text-brand-cream' : 'bg-brand-cream text-brand-chocolate'
                  }`}
                >
                  বাংলা
                </button>
                <button
                  onClick={() => { setLang('en'); setMobileMenuOpen(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    lang === 'en' ? 'bg-brand-chocolate text-brand-cream' : 'bg-brand-cream text-brand-chocolate'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-block text-xs font-medium text-brand-taupe hover:text-brand-caramel py-1"
              >
                🔒 {t('nav.admin')}
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
