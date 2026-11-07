'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalog } from '@/context/CatalogContext';
import ProductCard from '@/components/ProductCard';
import { 
  Sparkles, 
  ArrowRight, 
  Phone, 
  MapPin, 
  Heart, 
  Clock, 
  ChevronRight,
  CheckCircle2,
  Truck,
  Award,
  ChevronDown,
  ShoppingBag,
  HelpCircle
} from 'lucide-react';

export default function HomePage() {
  const { lang, t } = useLanguage();
  // Catalogue (products, categories, settings) comes from the shared
  // provider, fetched once per page load — not a separate API call here.
  const { products: featuredProducts, categories, settings, loading } = useCatalog();
  const [selectedCat, setSelectedCat] = useState<number | 'all'>('all');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // WhatsApp number from settings; empty until the shop configures it, in
  // which case WhatsApp buttons are hidden instead of showing a fake number.
  const whatsappNumber = (settings?.whatsapp_number || '').trim();
  const whatsappDigits = whatsappNumber.replace(/\D/g, '');
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits.startsWith('88') ? whatsappDigits : '88' + whatsappDigits}`
    : '';

  const displayProducts = selectedCat === 'all'
    ? featuredProducts
    : featuredProducts.filter((p) => p.category_id === selectedCat);

  // The hero showcase is the signature dish (seeded product
  // 'caramel-custard-flan'). Its name, photo, description and price come
  // from the live catalogue when it is published; the fallbacks match the
  // seeded dish so the card stays linked even on a sold-out day, when the
  // public catalogue hides it.
  const signature = featuredProducts.find((p) => p.slug === 'caramel-custard-flan');
  const heroDish = {
    nameEn: signature?.name_en ?? 'Caramel Custard Flan',
    nameBn: signature?.name_bn ?? 'ক্যারামেল কাস্টার্ড ফ্ল্যান',
    descEn: signature?.description_en ?? 'Silky baked custard with golden amber drizzle',
    descBn: signature?.description_bn ?? 'সোনালী ক্যারামেলের সাথে সিল্কি বেকড কাস্টার্ড',
    image: signature?.image_url || 'https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?w=800&auto=format&fit=crop&q=80',
    price: signature?.base_price ?? 450,
  };

  const faqs = [
    {
      qEn: 'How does ordering work? Do I need an account?',
      qBn: 'অর্ডার করার নিয়ম কী? কোনো অ্যাকাউন্ট খুলতে হবে?',
      aEn: 'No account needed! We offer frictionless guest checkout. Simply add your favorite desserts to your bag, enter your Rajshahi address & phone number, and choose Cash on Delivery or bKash/Nagad.',
      aBn: 'কোনো অ্যাকাউন্ট বা পাসওয়ার্ডের প্রয়োজন নেই! পছন্দের ডেজার্ট ব্যাগে যোগ করে আপনার নাম, ফোন নম্বর ও রাজশাহীর ঠিকানা দিয়ে খুব সহজে ক্যাশ অন ডেলিভারি বা বিকাশ/নগদে অর্ডার করুন।'
    },
    {
      qEn: 'How early should I place my order?',
      qBn: 'অর্ডার কতক্ষণ আগে দিতে হবে?',
      aEn: 'Because every dessert is made fresh from scratch upon order confirmation (never pre-frozen), we require a 3 to 4 hour lead time. Jar cakes can often be dispatched within 1-2 hours.',
      aBn: 'আমাদের প্রতিটি ডেজার্ট শতভাগ তাজা বেক করা হয় (আগে থেকে জমিয়ে রাখা হয় না)। তাই ফ্ল্যান ও কেকের জন্য ৩-৪ ঘন্টা আগে অর্ডার করার অনুরোধ করা হয়। জার কেক ১-২ ঘন্টায় সরবরাহ সম্ভব।'
    },
    {
      qEn: 'Which areas in Rajshahi do you deliver to?',
      qBn: 'রাজশাহীর কোন কোন এলাকায় ডেলিভারি দেওয়া হয়?',
      aEn: 'We deliver citywide across Rajshahi! Including Shaheb Bazar, Kazihata, Upashahar, Talaimari, RU / Motihar Campus, Laxmipur, Padma Residential, Bornali, and all surrounding areas.',
      aBn: 'আমরা রাজশাহী শহরের সব এলাকায় হোম ডেলিভারি পৌঁছে দিই—সাহেব বাজার, কাজীহাতা, উপশহর, তালাইমারী, রাজশাহী বিশ্ববিদ্যালয় ক্যাম্পাস, লক্ষ্মীপুর, পদ্মা আবাসিক, বর্ণালীসহ সমগ্র রাজশাহী।'
    },
    {
      qEn: 'What payment methods are supported?',
      qBn: 'পেমেন্টের কী কী মাধ্যম রয়েছে?',
      aEn: 'We support Cash on Delivery (COD) upon receiving your desserts, as well as bKash and Nagad Send Money with instant TrxID submission.',
      aBn: 'ডেলিভারি পাওয়ার পর ক্যাশ অন ডেলিভারি (COD) ছাড়াও বিকাশ এবং নগদ সেন্ড মানির মাধ্যমে নিশ্চিন্তে পেমেন্ট করতে পারেন।'
    },
    {
      qEn: 'Can I order customized boxes for birthdays or family events?',
      qBn: 'জন্মদিন বা বিশেষ অনুষ্ঠানের জন্য কাস্টম মিষ্টি বক্স অর্ডার করা যাবে?',
      aEn: 'Absolutely! Click the WhatsApp button to chat directly with our home bakery sister. We create personalized celebration dessert sets with ribbons and custom notes.',
      aBn: 'অবশ্যই! আমাদের হোয়াটসঅ্যাপ বাটনে ক্লিক করে সরাসরি কথা বলুন। যেকোনো পারিবারিক আয়োজন, জন্মদিন বা উপহারের জন্য আমরা সুন্দর রিবন দিয়ে সাজিয়ে বক্স তৈরি করি।'
    }
  ];

  return (
    <div className="space-y-16 sm:space-y-28 font-sans">
      
      {/* Hero Section: Editorial Boutique Patisserie Experience */}
      <section className="relative overflow-hidden bg-brand-cream border-b border-brand-chocolate/10 pt-12 pb-16 sm:py-24 px-4 sm:px-6">

        <div className="max-w-6xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Editorial Copy */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            
            {/* Boutique Badge */}
            <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-semibold text-brand-caramel border border-brand-chocolate/10 shadow-xs tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-brand-caramel" />
              <span>{lang === 'bn' ? 'রাজশাহীর ঘরোয়া প্রিমিয়াম পেটিসারি' : 'Boutique Homemade Patisserie • Rajshahi'}</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-brand-chocolate leading-[1.12]">
              {lang === 'bn' ? (
                <>
                  ভালোবাসায় তৈরি <br />
                  <span className="font-editorial text-brand-caramel italic font-medium tracking-normal">খাঁটি ঘরোয়া ডেজার্ট</span>
                </>
              ) : (
                <>
                  Artisanal Desserts <br />
                  <span className="font-editorial text-brand-caramel italic font-medium tracking-normal">Crafted with Love</span>
                </>
              )}
            </h1>

            {/* Signature Brand Tagline */}
            <p className="font-editorial text-xl sm:text-2xl text-brand-chocolate/85 italic tracking-normal">
              {lang === 'bn' ? '“একটু মিষ্টি, অনেকটা আনন্দ।”' : '“A Little Sweetness, A Lot of Happiness.”'}
            </p>

            <p className="text-sm sm:text-base text-brand-taupe max-w-xl mx-auto lg:mx-0 leading-[1.78]">
              {lang === 'bn'
                ? 'শতভাগ খাঁটি ডেইরি ক্রিম, আসল মাখন ও পরম যত্নে রাজশাহীর নিজস্ব কিচেনে তৈরি তাজা ডেজার্ট। অর্ডার করার পর প্রতিটি মিষ্টি নিখুঁতভাবে বেক করে সরাসরি পৌঁছে দেওয়া হয় আপনার দোরগোড়ায়।'
                : 'Small-batch velvety crème caramel flans, moist Belgian chocolate fudge cakes, and artisan jar treats. Baked fresh upon your order confirmation using 100% pure dairy cream & butter — delivered citywide across Rajshahi.'}
            </p>

            {/* Delivery Coverage Capsule */}
            <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl text-xs sm:text-sm text-brand-chocolate font-medium border border-brand-chocolate/10 shadow-xs">
              <MapPin className="w-4 h-4 text-brand-caramel shrink-0" />
              <span>{t('hero.coverageNote')}</span>
            </div>

            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
              <Link
                href="/menu"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-brand-caramel hover:bg-brand-chocolate text-white font-semibold py-3.5 px-8 rounded-full shadow-soft hover:shadow-card transition-all duration-200 btn-press group text-sm"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{t('hero.ctaMenu')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              {whatsappUrl && (
              <a
                href={`${whatsappUrl}?text=${encodeURIComponent('Salam! I would like to order homemade desserts from Sweet Cravings.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-brand-forest hover:bg-brand-chocolate text-white font-semibold py-3.5 px-7 rounded-full shadow-soft hover:shadow-card transition-all duration-200 btn-press text-sm"
              >
                <Phone className="w-4 h-4" />
                <span>{t('hero.ctaWhatsApp')}</span>
              </a>
              )}
            </div>

            {/* Micro Proof Chips */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-brand-taupe">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-brand-forest" />
                <span>{lang === 'bn' ? '১০০% খাঁটি দুধ ও মাখন' : '100% Pure Dairy & Butter'}</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-brand-forest" />
                <span>{lang === 'bn' ? 'অর্ডারের পর তৈরি' : 'Baked Fresh Upon Order'}</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-brand-forest" />
                <span>{lang === 'bn' ? 'ক্যাশ অন ডেলিভারি ও বিকাশ' : 'Cash on Delivery & bKash'}</span>
              </span>
            </div>

          </div>

          {/* Right Visual Showcase Card */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="relative w-full max-w-md">
              
              {/* Main Dessert Photography Card — a real link to the
                  signature dish's product page, not a static picture.
                  The whole card is clickable, keyboard-focusable, and
                  carries a visible "View details" cue. */}
              <Link
                href="/menu/caramel-custard-flan"
                aria-label={`${lang === 'bn' ? heroDish.nameBn : heroDish.nameEn} — ${t('hero.viewSignature')}`}
                className="block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-caramel"
              >
              <div className="relative rounded-3xl overflow-hidden bg-white/95 p-3 shadow-card hover:shadow-card-hover border border-brand-chocolate/10 transition-all duration-500 hover:scale-[1.01]">
                <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-2xl overflow-hidden bg-brand-cream">
                  <Image
                    src={heroDish.image}
                    alt={lang === 'bn' ? heroDish.nameBn : heroDish.nameEn}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

                  {/* Photo Title Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-brand-caramel/90 px-2.5 py-0.5 rounded-md inline-block mb-1 shadow-xs">
                      Signature Hero
                    </span>
                    <p className="font-heading font-semibold text-lg leading-tight">
                      {lang === 'bn' ? heroDish.nameBn : heroDish.nameEn}
                    </p>
                    <p className="text-xs text-brand-cream/90 line-clamp-2">
                      {lang === 'bn' ? heroDish.descBn : heroDish.descEn}
                    </p>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {lang === 'bn' ? 'শুরু মাত্র' : 'Starting from'} ৳{heroDish.price}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-white text-brand-chocolate text-[11px] font-bold px-3 py-1.5 rounded-full shadow-xs">
                        {t('hero.viewSignature')}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              </Link>

              {/* Brand crest seal — the only floating element on the hero */}
              <div className="absolute -top-6 -left-6 sm:-top-8 sm:-left-8 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-white shadow-card bg-white ring-4 ring-brand-caramel/15">
                <Image
                  src="/sweet-cravings-logo.jpg"
                  alt="Sweet Cravings Seal"
                  width={224}
                  height={224}
                  className="object-cover w-full h-full"
                />
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Trust & Craftsmanship Pillars Ribbon */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          
          <div className="bg-white/95 p-5 rounded-2xl border border-brand-chocolate/10 shadow-card space-y-2 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-brand-caramel/10 text-brand-caramel flex items-center justify-center mx-auto sm:mx-0">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-brand-chocolate">{lang === 'bn' ? '১০০% আসল দুধ' : '100% Real Dairy'}</h3>
            <p className="text-xs text-brand-taupe leading-relaxed">{lang === 'bn' ? 'খাঁটি গরুর দুধ, মাখন ও ক্রিম। কোনো মার্জারিন নেই।' : 'Pure cow milk, butter & sweet cream. Zero margarine.'}</p>
          </div>

          <div className="bg-white/95 p-5 rounded-2xl border border-brand-chocolate/10 shadow-card space-y-2 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-brand-forest/10 text-brand-forest flex items-center justify-center mx-auto sm:mx-0">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-brand-chocolate">{lang === 'bn' ? 'অর্ডারে তৈরি' : 'Baked to Order'}</h3>
            <p className="text-xs text-brand-taupe leading-relaxed">{lang === 'bn' ? 'আগে থেকে বানানো নয় — সরাসরি ওভেন থেকে।' : 'Never frozen or pre-stocked. Fresh from the oven.'}</p>
          </div>

          <div className="bg-white/95 p-5 rounded-2xl border border-brand-chocolate/10 shadow-card space-y-2 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-brand-cream text-brand-caramel flex items-center justify-center mx-auto sm:mx-0">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-brand-chocolate">{lang === 'bn' ? 'ঠান্ডা ডেলিভারি' : 'Chilled Delivery'}</h3>
            <p className="text-xs text-brand-taupe leading-relaxed">{lang === 'bn' ? 'রাজশাহীজুড়ে ঠান্ডা রাখা প্যাকেজিংয়ে ডেলিভারি।' : 'Citywide Rajshahi delivery in insulated food packaging.'}</p>
          </div>

          <div className="bg-white/95 p-5 rounded-2xl border border-brand-chocolate/10 shadow-card space-y-2 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-brand-caramel/10 text-brand-chocolate flex items-center justify-center mx-auto sm:mx-0">
              <Heart className="w-5 h-5 fill-brand-chocolate/20" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-brand-chocolate">{lang === 'bn' ? 'ঘরের যত্ন' : 'Homemade Care'}</h3>
            <p className="text-xs text-brand-taupe leading-relaxed">{lang === 'bn' ? 'বোনের নিজের রান্নাঘর, পরিচ্ছন্নতায় যত্ন।' : 'Sister-run kitchen with meticulous hygiene standards.'}</p>
          </div>

        </div>
      </section>

      {/* Curated Menu & Category Switcher Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-brand-chocolate/10 pb-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-caramel block mb-1">
              {lang === 'bn' ? 'আমাদের মিষ্টি আয়োজন' : 'Curated Artisanal Menu'}
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-brand-chocolate tracking-tight">
              {t('home.signatureTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-brand-taupe mt-1 max-w-md">
              {t('home.signatureSubtitle')}
            </p>
          </div>

          <Link
            href="/menu"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-brand-caramel hover:text-brand-chocolate transition-colors self-start md:self-auto"
          >
            <span>{t('home.viewAllMenu')}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Category Pill Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCat('all')}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              selectedCat === 'all'
                ? 'bg-brand-chocolate text-brand-cream shadow-soft'
                : 'bg-white/90 border border-brand-chocolate/10 text-brand-taupe hover:text-brand-chocolate hover:bg-white'
            }`}
          >
            {t('menu.allCategories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                selectedCat === cat.id
                  ? 'bg-brand-chocolate text-brand-cream shadow-soft'
                  : 'bg-white/90 border border-brand-chocolate/10 text-brand-taupe hover:text-brand-chocolate hover:bg-white'
              }`}
            >
              {lang === 'bn' ? cat.name_bn : cat.name_en}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-white/80 rounded-3xl h-80 animate-pulse border border-brand-chocolate/10" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {displayProducts.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="text-center pt-4">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 bg-brand-caramel hover:bg-brand-chocolate text-white font-semibold py-3.5 px-8 rounded-full shadow-soft hover:shadow-card transition-all btn-press text-sm"
          >
            <span>{t('home.viewAllMenu')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Artisanal Difference & Ingredient Transparency Feature */}
      <section className="bg-white border-y border-brand-chocolate/10 py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-caramel bg-brand-caramel/10 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'খাঁটি উপাদানের নিশ্চয়তা' : 'Uncompromising Quality'}</span>
            </div>
            
            <h2 className="font-heading text-3xl sm:text-5xl font-semibold text-brand-chocolate tracking-tight">
              {lang === 'bn' ? 'কেন সুইট ক্রেভিংস অনন্য?' : 'The Sweet Cravings Difference'}
            </h2>

            <p className="text-sm sm:text-base text-brand-taupe leading-[1.78]">
              {lang === 'bn'
                ? 'বাণিজ্যিক বেকারিগুলোতে খরচ কমাতে হাইড্রোজেনেটেড ফ্যাট ও কৃত্রিম প্রিজারভেটিভ ব্যবহার করা হলেও, আমরা আমাদের প্রতিটি ডেজার্টে ব্যবহার করি ১০০% খাঁটি গরুর দুধ, ডেইরি মাখন, আসল ভ্যানিলা এবং বেলজিয়ান চকলেট।'
                : 'Unlike commercial bakeries that rely on hydrogenated shortenings and artificial preservatives, every Sweet Cravings creation is prepared fresh with pure farm dairy milk, imported Dutch cocoa, real butter, and love.'}
            </p>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-forest/10 text-brand-forest flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-brand-chocolate">{lang === 'bn' ? 'কোনো কৃত্রিম প্রিজারভেটিভ নয়' : 'Zero Artificial Preservatives'}</h4>
                  <p className="text-xs text-brand-taupe leading-relaxed">{lang === 'bn' ? 'পরিবারের সবার জন্য নিরাপদ, পরিচ্ছন্ন মিষ্টি।' : 'Clean, wholesome desserts that are safe and delightful for the whole family.'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-forest/10 text-brand-forest flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-brand-chocolate">{lang === 'bn' ? 'ধীরে ধীরে তৈরি, সতেজ বেক' : 'Fresh Slow-Baking Technique'}</h4>
                  <p className="text-xs text-brand-taupe leading-relaxed">{lang === 'bn' ? 'ধীরে রান্না করা কাস্টার্ড ও নরম স্পঞ্জ, মুখে দিলেই গলে যায়।' : 'Slow-cooked water bath custards and tender sponges that melt smoothly in your mouth.'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-forest/10 text-brand-forest flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-brand-chocolate">{lang === 'bn' ? 'পরিচ্ছন্ন ঘরের রান্নাঘর' : 'Hygienic Home Kitchen Setting'}</h4>
                  <p className="text-xs text-brand-taupe leading-relaxed">{lang === 'bn' ? 'রাজশাহীতেই যত্ন ও পরিচ্ছন্নতায় তৈরি।' : 'Prepared with surgical cleanliness and utmost care right here in Rajshahi.'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Comparison Card */}
          <div className="lg:col-span-6 bg-brand-cream/50 p-6 sm:p-8 rounded-3xl border border-brand-chocolate/10 shadow-card space-y-6">
            <h3 className="font-heading font-semibold text-xl text-brand-chocolate border-b border-brand-chocolate/10 pb-3">
              {lang === 'bn' ? 'আমাদের মানদণ্ড বনাম সাধারণ বেকারি' : 'Artisanal Standards vs Commercial Bakeries'}
            </h3>

            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/95 border border-brand-chocolate/10">
                <div>
                  <span className="text-[10px] font-semibold text-brand-taupe uppercase tracking-wider block">{lang === 'bn' ? 'মাখন ও ক্রিম' : 'Butter & Cream'}</span>
                  <span className="font-semibold text-brand-chocolate">{lang === 'bn' ? '১০০% খাঁটি দুধের মাখন' : '100% Pure Dairy Butter'}</span>
                </div>
                <span className="text-xs font-semibold text-brand-forest bg-brand-forest/10 px-2.5 py-1 rounded-full">
                  Sweet Cravings
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/95 border border-brand-chocolate/10">
                <div>
                  <span className="text-[10px] font-semibold text-brand-taupe uppercase tracking-wider block">{lang === 'bn' ? 'সতেজতা' : 'Freshness'}</span>
                  <span className="font-semibold text-brand-chocolate">{lang === 'bn' ? 'অর্ডারের পর আজই বেক করা' : 'Baked Today After Order'}</span>
                </div>
                <span className="text-xs font-semibold text-brand-forest bg-brand-forest/10 px-2.5 py-1 rounded-full">
                  {lang === 'bn' ? 'কখনো ফ্রোজেন নয়' : 'Never Frozen'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/95 border border-brand-chocolate/10">
                <div>
                  <span className="text-[10px] font-semibold text-brand-taupe uppercase tracking-wider block">{lang === 'bn' ? 'স্বাদ' : 'Flavors'}</span>
                  <span className="font-semibold text-brand-chocolate">{lang === 'bn' ? 'আসল ভ্যানিলা ও কোকো' : 'Natural Vanilla Bean & Cocoa'}</span>
                </div>
                <span className="text-xs font-semibold text-brand-forest bg-brand-forest/10 px-2.5 py-1 rounded-full">
                  {lang === 'bn' ? 'খাঁটি' : 'Authentic'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Frequently Asked Questions (Interactive Accordion) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-caramel">
            {lang === 'bn' ? 'সাধারণ জিজ্ঞাসা' : 'Got Questions?'}
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-brand-chocolate">
            {lang === 'bn' ? 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলী' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-xs sm:text-sm text-brand-taupe">
            {lang === 'bn' ? 'অর্ডার ও ডেলিভারি সম্পর্কিত যাবতীয় তথ্য' : 'Everything you need to know about ordering and delivery'}
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white/95 rounded-2xl border border-brand-chocolate/10 shadow-card overflow-hidden transition-all hover:border-brand-caramel/30"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-brand-chocolate hover:text-brand-caramel transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-brand-caramel shrink-0" />
                    <span>{lang === 'bn' ? faq.qBn : faq.qEn}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-brand-taupe transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-brand-caramel' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-brand-taupe leading-[1.78] border-t border-brand-chocolate/10 pt-3 animate-fadeIn">
                    {lang === 'bn' ? faq.aBn : faq.aEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* WhatsApp VIP Concierge Callout Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-brand-forest rounded-3xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-card border border-white/10">
          <div className="space-y-2 text-center md:text-left">
            <span className="bg-white/10 text-brand-cream text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              {lang === 'bn' ? 'কাস্টম ও জরুরি অর্ডার' : 'Custom & Celebration Boxes'}
            </span>
            <h3 className="font-heading text-2xl sm:text-3xl font-semibold">
              {lang === 'bn' ? 'হোয়াটসঅ্যাপে সরাসরি কথা বলুন' : 'Direct WhatsApp Concierge'}
            </h3>
            <p className="text-brand-cream/85 text-xs sm:text-sm max-w-lg leading-relaxed">
              {lang === 'bn' 
                ? 'কোনো বিশেষ জন্মদিন, পরিবারের দাওয়াত বা স্পেশাল উপহার বক্সের প্রয়োজন? আমাদের সাথে সরাসরি যোগাযোগ করুন।' 
                : 'Need custom celebration dessert sets or special gift packaging in Rajshahi? Chat directly with our bakery sister.'}
            </p>
          </div>

          {whatsappUrl && (
          <a
            href={`${whatsappUrl}?text=${encodeURIComponent('Salam! I have an inquiry about Sweet Cravings desserts.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 bg-brand-forest hover:bg-brand-chocolate border border-white/20 text-white font-semibold py-3.5 px-8 rounded-full shadow-soft hover:shadow-card transition-all btn-press text-sm"
          >
            <Phone className="w-4 h-4" />
            <span>{whatsappNumber}</span>
          </a>
          )}
        </div>
      </section>

    </div>
  );
}
