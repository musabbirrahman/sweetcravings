'use client';

import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
import { toWhatsAppDigits } from '@/lib/phone';
import { Phone, MapPin, Clock, MessageSquare } from 'lucide-react';

export default function ContactPage() {
  const { lang, t } = useLanguage();
  // WhatsApp number comes from the shared catalogue (fetched once per
  // page load); empty until the shop configures it.
  const { settings } = useCatalog();
  const phoneNum = settings?.whatsapp_number || '';

  const waPhone = toWhatsAppDigits(phoneNum);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
      
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-brand-caramel/10 text-brand-caramel text-[13px] font-bold px-3 py-1 rounded-full uppercase">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'আমাদের সাথে যোগাযোগ' : 'Connect with Us'}</span>
        </div>
        <h1 className="font-heading text-[32px] sm:text-[40px] font-bold text-brand-chocolate leading-[1.15]">
          {t('contact.title')}
        </h1>
        <p className="text-sm sm:text-base text-brand-taupe max-w-xl mx-auto leading-[1.78]">
          {t('contact.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* WhatsApp & Call Direct */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E7DFD6] shadow-soft space-y-6">
          <h2 className="font-heading font-bold text-xl text-brand-chocolate border-b border-[#E7DFD6] pb-3">
            {t('contact.reachUs')}
          </h2>

          <div className="space-y-4">
            {phoneNum ? (
            <a
              href={`https://wa.me/${waPhone}?text=${encodeURIComponent('Salam! I have an inquiry about Sweet Cravings.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 p-4 rounded-2xl bg-brand-forest/10 border border-brand-forest/25 text-brand-forest hover:bg-brand-forest/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-white border border-[#E7DFD6] text-brand-forest flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[13px] uppercase font-bold text-brand-forest block">
                  {t('contact.whatsappChat')}
                </span>
                <span className="font-bold text-base text-brand-chocolate font-mono">
                  {phoneNum}
                </span>
              </div>
            </a>
            ) : (
            <p className="text-[13px] text-brand-taupe p-4 rounded-2xl bg-brand-cream/50 border border-[#E7DFD6]">
              {lang === 'bn'
                ? 'হোয়াটসঅ্যাপ নম্বর এখনো দেওয়া হয়নি — অর্ডার করতে মেনু থেকে সরাসরি অর্ডার করুন।'
                : 'Our WhatsApp number is not listed yet — please order directly from the menu.'}
            </p>
            )}

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-cream/50 border border-[#E7DFD6]">
              <Clock className="w-5 h-5 text-brand-caramel shrink-0 mt-0.5" />
              <div className="text-[13px] text-brand-taupe space-y-1">
                <p className="font-bold text-brand-chocolate text-sm">
                  {lang === 'bn' ? 'অর্ডার ও কিচেনের সময়সূচি' : 'Baking & Order Hours'}
                </p>
                <p>Saturday – Thursday: 10:00 AM – 9:00 PM</p>
                <p>Friday: 2:00 PM – 9:00 PM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coverage & Location Statement */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E7DFD6] shadow-soft space-y-6">
          <h2 className="font-heading font-bold text-xl text-brand-chocolate border-b border-[#E7DFD6] pb-3">
            {t('contact.locationTitle')}
          </h2>

          <div className="space-y-4 text-[13px] sm:text-sm text-brand-taupe leading-relaxed">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-brand-forest shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-brand-chocolate">Rajshahi City, Bangladesh</p>
                <p className="mt-1">
                  {lang === 'bn'
                    ? 'আমাদের হোম কিচেন রাজশাহীতে অবস্থিত। সাহেব বাজার, উপশহর, তালাইমারী, রাজশাহী বিশ্ববিদ্যালয় ক্যাম্পাস, পদ্মা আবাসিক, লক্ষ্মীপুরসহ রাজশাহী শহরের যেকোনো ঠিকানায় ডেলিভারি পৌঁছে দেওয়া হয়।'
                    : 'We deliver freshly made desserts across Shaheb Bazar, Upashahar, Talaimari, RU Campus, Padma Residential, Laxmipur, and all major areas in Rajshahi.'}
                </p>
              </div>
            </div>

            <div className="bg-brand-cream p-4 rounded-2xl border border-[#E7DFD6] text-[13px] space-y-1">
              <p className="font-bold text-brand-chocolate">
                {lang === 'bn' ? 'পিকআপ সংক্রান্ত তথ্য:' : 'Self-Pickup Information:'}
              </p>
              <p className="text-brand-taupe">
                {lang === 'bn' 
                  ? 'বর্তমান নিয়মে সকল অর্ডার হোম ডেলিভারির মাধ্যমে পৌঁছানো হয়। স্পেশাল বাল্ক অর্ডারের জন্য হোয়াটসঅ্যাপে আলোচনা করুন।' 
                  : 'Currently we fulfill orders primarily via citywide doorstep delivery. For large bulk orders, please coordinate on WhatsApp.'}
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
