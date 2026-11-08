'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';

export default function FloatingWhatsAppButton() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const { settings } = useCatalog();

  // WhatsApp number comes from the shared catalogue (fetched once per
  // page load); empty until the shop configures it.
  const whatsappNumber = settings?.whatsapp_number || '';

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  // No WhatsApp button until the shop's real number is configured.
  if (!whatsappNumber) {
    return null;
  }

  const cleanNum = whatsappNumber.replace(/\D/g, '');
  const waPhone = cleanNum.startsWith('88') ? cleanNum : `88${cleanNum}`;
  const greeting = encodeURIComponent('Salam Sweet Cravings! I have a question about placing an order in Rajshahi.');
  const waUrl = `https://wa.me/${waPhone}?text=${greeting}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Sweet Cravings on WhatsApp"
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 bg-white hover:bg-[#FBF9F6] text-brand-chocolate border border-[#E7DFD6] p-3.5 sm:px-4 sm:py-3 rounded-full shadow-card hover:shadow-card-hover flex items-center gap-2 transition-all duration-300 transform hover:scale-105 active:scale-95 group"
    >
      <MessageCircle className="w-5 h-5 text-brand-forest fill-current" />
      <span className="hidden sm:inline font-bold text-[13px] tracking-wide">
        {lang === 'bn' ? 'হোয়াটসঅ্যাপে সাহায্য' : 'WhatsApp Us'}
      </span>
    </a>
  );
}
