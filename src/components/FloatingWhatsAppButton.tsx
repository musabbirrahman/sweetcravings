'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function FloatingWhatsAppButton() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const [whatsappNumber, setWhatsappNumber] = useState('');

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.whatsapp_number) {
          setWhatsappNumber(data.settings.whatsapp_number);
        }
      })
      .catch(() => {});
  }, []);

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
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 bg-[#25D366] hover:bg-[#20BA5A] text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-card hover:shadow-card-hover flex items-center gap-2 transition-all duration-300 transform hover:scale-105 active:scale-95 group"
    >
      <MessageCircle className="w-5 h-5 fill-current" />
      <span className="hidden sm:inline font-bold text-xs tracking-wide">
        {lang === 'bn' ? 'হোয়াটসঅ্যাপে সাহায্য' : 'WhatsApp Us'}
      </span>
    </a>
  );
}
