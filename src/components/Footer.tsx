'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
import { Phone, MapPin, ShieldCheck, Clock } from 'lucide-react';

export default function Footer() {
  const { lang, t } = useLanguage();
  const { settings } = useCatalog();
  const pathname = usePathname();

  // WhatsApp number comes from the shared catalogue (fetched once per
  // page load); empty until the shop configures it.
  const phoneNum = settings?.whatsapp_number || '';

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-brand-chocolate text-[#F5EFE6] border-t border-white/10 mt-16">
      {/* Upper footer */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10 shadow-sm bg-brand-cream">
                <Image 
                  src="/sweet-cravings-logo.jpg" 
                  alt="Sweet Cravings" 
                  width={112}
                  height={112}
                  className="object-cover w-full h-full"
                />
              </div>
              <div>
                <span className="font-heading text-2xl font-bold text-brand-cream tracking-tight block">
                  Sweet Cravings
                </span>
                <span className="text-sm text-brand-cream/70 block">
                  {lang === 'bn' ? 'একটু মিষ্টি, অনেকটা আনন্দ।' : 'A Little Sweetness, A Lot of Happiness.'}
                </span>
              </div>
            </div>

            <p className="text-brand-cream/70 text-sm max-w-md leading-relaxed">
              {lang === 'bn'
                ? 'রাজশাহীর নিজস্ব ঘরোয়া কিচেন থেকে শতভাগ খাঁটি উপাদান, আসল মাখন ও পরম ভালোবাসায় তৈরি তাজা ডেজার্ট পৌঁছে দিচ্ছি আপনার দোরগোড়ায়।'
                : 'Handcrafting authentic, small-batch artisanal desserts in Rajshahi with 100% pure dairy cream, butter, and love.'}
            </p>

            <div className="flex items-center gap-3 text-[13px] text-brand-cream/90 pt-1">
              <MapPin className="w-4 h-4 text-brand-caramel" />
              <span>{lang === 'bn' ? 'রাজশাহী শহরজুড়ে হোম ডেলিভারি' : 'Citywide Delivery across Rajshahi'}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-brand-cream font-bold text-[13px] uppercase tracking-wider mb-3">
              {lang === 'bn' ? 'প্রয়োজনীয় লিংক' : 'Quick Navigation'}
            </h4>
            <ul className="space-y-2.5 text-sm text-brand-cream/65">
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
            <h4 className="text-brand-cream font-bold text-[13px] uppercase tracking-wider mb-3">
              {lang === 'bn' ? 'অর্ডার ও যোগাযোগ' : 'Order & Inquiries'}
            </h4>
            <div className="space-y-3 text-sm text-brand-cream/65">
              {phoneNum && (
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
              )}
              <p className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-brand-caramel mt-0.5 shrink-0" />
                <span>
                  {lang === 'bn' ? 'অর্ডার গ্রহণের সময়: সকাল ১০টা - রাত ৯টা' : 'Order Hours: 10:00 AM - 9:00 PM'}
                </span>
              </p>
              <div className="pt-2">
                <Link 
                  href="/admin" 
                  className="inline-flex items-center gap-1.5 text-[13px] text-brand-cream/65 hover:text-white border border-white/10 px-3 py-1.5 rounded-full transition-colors"
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
      <div className="border-t border-white/10 py-5 px-4 text-center text-[13px] text-brand-cream/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Sweet Cravings Homemade Desserts. Rajshahi, Bangladesh.</p>
          <p>Baked with care for dessert lovers.</p>
        </div>
      </div>
    </footer>
  );
}
