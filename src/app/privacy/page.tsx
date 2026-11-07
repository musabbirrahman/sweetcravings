'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const { lang, t } = useLanguage();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-caramel hover:underline mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'হোমে ফিরে যান' : 'Back to Home'}</span>
        </Link>
        <h1 className="font-heading text-3xl font-bold text-brand-chocolate">
          {t('privacy.title')}
        </h1>
        <p className="text-sm text-brand-taupe mt-1">
          {t('privacy.subtitle')}
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-brand-chocolate/10 shadow-soft space-y-4 text-sm text-brand-taupe leading-relaxed">
        <div className="flex items-center gap-2 text-brand-forest font-bold">
          <ShieldCheck className="w-5 h-5" />
          <span>Sweet Cravings Privacy Commitment</span>
        </div>

        <p>{t('privacy.content')}</p>

        <h3 className="font-heading font-bold text-brand-chocolate text-base pt-2">
          {lang === 'bn' ? 'সংগৃহীত তথ্যসমূহ:' : 'Data We Collect:'}
        </h3>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm pl-2">
          <li>{lang === 'bn' ? 'গ্রাহকের পুরো নাম' : 'Customer Name'}</li>
          <li>{lang === 'bn' ? 'ডেলিভারি সমন্বয়ের জন্য ফোন ও হোয়াটসঅ্যাপ নম্বর' : 'Phone & WhatsApp number for order coordination'}</li>
          <li>{lang === 'bn' ? 'রাজশাহীর ডেলিভারি ঠিকানা ও ল্যান্ডমার্ক' : 'Rajshahi delivery address & landmark'}</li>
          <li>{lang === 'bn' ? 'বিকাশ বা নগদ ট্রানজেকশন আইডি (TrxID) - কেবল পেমেন্ট যাচাইয়ের জন্য' : 'bKash/Nagad Transaction ID (TrxID) for payment verification'}</li>
        </ul>

        <h3 className="font-heading font-bold text-brand-chocolate text-base pt-2">
          {lang === 'bn' ? 'তথ্য অপসারণ অনুরোধ:' : 'Data Deletion Requests:'}
        </h3>
        <p className="text-xs sm:text-sm">
          {lang === 'bn'
            ? 'আপনি চাইলে যেকোনো সময় আমাদের অফিশিয়াল হোয়াটসঅ্যাপে মেসেজ পাঠিয়ে আপনার অতীত অর্ডারের রেকর্ড মুছে ফেলার অনুরোধ জানাতে পারেন।'
            : 'You can request deletion or anonymization of your past order history at any time by messaging our official WhatsApp.'}
        </p>
      </div>
    </div>
  );
}
