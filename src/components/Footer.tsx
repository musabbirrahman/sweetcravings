'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { Heart, Phone, MapPin, ShieldCheck, Clock } from 'lucide-react';

export default function Footer() {
  const { lang, t } = useLanguage();
  const pathname = usePathname();
  const [phoneNum, setPhoneNum] = React.useState('+880 1712-345678');

  React.useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.whatsapp_number) setPhoneNum(d.settings.whatsapp_number);
      })
      .catch(() => {});
  }, []);

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-[#241813] text-[#F5EFE6] border-t border-[#38271E] mt-24">
      {/* Upper footer */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-full overflow-hidden border border-white/10 shadow-sm bg-brand-cream">
                <Image 
                  src="/sweet-cravings-logo.jpg" 
                  alt="Sweet Cravings" 
                  fill 
                  className="object-cover"
                />
              </div>
              <div>
                <span className="font-heading text-2xl font-bold text-brand-gold-light tracking-tight block">
                  Sweet Cravings
                </span>
                <span className="font-editorial text-sm text-brand-gold-light/90 italic block">
                  {lang === 'bn' ? '“একটু মিষ্টি, অনেকটা আনন্দ।”' : '“A Little Sweetness, A Lot of Happiness.”'}
                </span>
              </div>
            </div>

            <p className="text-brand-cream-subtle/80 text-sm max-w-md leading-relaxed">
              {lang === 'bn'
                ? 'রাজশাহীর নিজস্ব ঘরোয়া কিচেন থেকে শতভাগ খাঁটি উপাদান, আসল মাখন ও পরম ভালোবাসায় তৈরি তাজা ডেজার্ট পৌঁছে দিচ্ছি আপনার দোরগোড়ায়।'
                : 'Handcrafting authentic, small-batch artisanal desserts in Rajshahi with 100% pure dairy cream, butter, and love.'}
            </p>

            <div className="flex items-center gap-3 text-xs text-brand-gold-light/90 pt-1">
              <MapPin className="w-4 h-4 text-brand-caramel" />
              <span>{lang === 'bn' ? 'রাজশাহী শহরজুড়ে হোম ডেলিভারি' : 'Citywide Delivery across Rajshahi'}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-brand-gold-light font-bold text-xs uppercase tracking-wider mb-3">
              {lang === 'bn' ? 'প্রয়োজনীয় লিংক' : 'Quick Navigation'}
            </h4>
            <ul className="space-y-2.5 text-sm text-brand-cream-subtle/75">
              <li>
                <Link href="/menu" className="hover:text-white transition-colors">
                  {t('nav.menu')}
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link href="/track" className="hover:text-white transition-colors">
                  {t('nav.track')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  {t('nav.contact')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  {t('privacy.title')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Hours */}
          <div>
            <h4 className="text-brand-gold-light font-bold text-xs uppercase tracking-wider mb-3">
              {lang === 'bn' ? 'অর্ডার ও যোগাযোগ' : 'Order & Inquiries'}
            </h4>
            <div className="space-y-3 text-sm text-brand-cream-subtle/75">
              <p className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  WhatsApp: <br />
                  <a 
                    href={`https://wa.me/${phoneNum.replace(/\D/g, '').startsWith('88') ? phoneNum.replace(/\D/g, '') : '88' + phoneNum.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-emerald-300 hover:text-emerald-200 hover:underline font-semibold"
                  >
                    {phoneNum}
                  </a>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-brand-caramel mt-0.5 shrink-0" />
                <span>
                  {lang === 'bn' ? 'অর্ডার গ্রহণের সময়: সকাল ১০টা - রাত ৯টা' : 'Order Hours: 10:00 AM - 9:00 PM'}
                </span>
              </p>
              <div className="pt-2">
                <Link 
                  href="/admin" 
                  className="inline-flex items-center gap-1.5 text-xs text-brand-gold-light/80 hover:text-white border border-white/10 px-3 py-1.5 rounded-full transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'এডমিন পোর্টাল' : 'Admin Portal'}</span>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom copyright */}
      <div className="border-t border-[#38271E] py-5 px-4 text-center text-xs text-brand-cream-subtle/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Sweet Cravings Homemade Desserts. Rajshahi, Bangladesh.</p>
          <p className="flex items-center gap-1">
            <span>Baked with</span>
            <Heart className="w-3.5 h-3.5 text-brand-strawberry fill-brand-strawberry" />
            <span>for dessert lovers.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
