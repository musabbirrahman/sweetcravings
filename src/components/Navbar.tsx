'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
import { useCart } from '@/context/CartContext';
import { toWhatsAppDigits } from '@/lib/phone';
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
      <div className="bg-brand-chocolate text-brand-cream text-[13px] font-medium py-2 px-4 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-brand-cream/95 tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
              {lang === 'bn' 
                ? 'রাজশাহীতে তাজা ঘরে তৈরি ডেজার্ট ডেলিভারি' 
                : 'Fresh desserts, delivered across Rajshahi'}
            </span>
          </div>

          <div className="flex items-center gap-3.5 shrink-0">
            {phoneNum && (
            <a 
              href={`https://wa.me/${toWhatsAppDigits(phoneNum)}?text=${encodeURIComponent('Salam! I have an inquiry about Sweet Cravings desserts.')}`}
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
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-full border border-white/10 text-brand-cream text-[13px] font-semibold transition-all btn-press shrink-0"
              title="Change Language"
            >
              <Globe className="w-3 h-3 text-brand-cream" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation: Sticky Frosted Glass */}
      <header className="sticky top-0 z-40 glass-nav border-b border-[#E7DFD6] shadow-soft transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Brand Title */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[#E7DFD6] shadow-sm group-hover:scale-105 transition-transform bg-white">
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
              <span className="font-heading text-xl font-bold text-brand-chocolate tracking-tight block leading-tight group-hover:text-brand-caramel transition-colors">
                Sweet Cravings
              </span>
              <span className="text-[12px] font-medium text-brand-taupe tracking-wider block">
                {lang === 'bn' ? 'হোমমেড ডেজার্টস • রাজশাহী' : 'Homemade Desserts • Rajshahi'}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-brand-cream/50 p-1 rounded-full border border-[#E7DFD6]">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[15px] font-semibold px-4 py-2 rounded-full transition-all duration-200 ${
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
                  <span className="absolute -top-2 -right-2 bg-[#EFE9E2] text-brand-chocolate text-[13px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-brand-chocolate">
                    {totalItemsCount}
                  </span>
                )}
              </div>
              <span className="font-heading font-bold text-[13px] tracking-wide">
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
          <div className="md:hidden bg-white/98 backdrop-blur-xl border-b border-[#E7DFD6] px-5 pt-3 pb-6 space-y-2 shadow-xl animate-fade-in-up">
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

            <div className="pt-3 border-t border-[#E7DFD6] flex items-center justify-between">
              <span className="text-[13px] text-brand-taupe font-medium">
                {lang === 'bn' ? 'ভাষা নির্বাচন করুন:' : 'Language:'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setLang('bn'); setMobileMenuOpen(false); }}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                    lang === 'bn' ? 'bg-brand-chocolate text-brand-cream' : 'bg-brand-cream text-brand-chocolate'
                  }`}
                >
                  বাংলা
                </button>
                <button
                  onClick={() => { setLang('en'); setMobileMenuOpen(false); }}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                    lang === 'en' ? 'bg-brand-chocolate text-brand-cream' : 'bg-brand-cream text-brand-chocolate'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
