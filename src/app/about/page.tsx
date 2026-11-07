'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Heart, ShieldCheck, ArrowRight, Sparkles, Award, Clock, MapPin, CheckCircle2 } from 'lucide-react';

export default function AboutPage() {
  const { lang, t } = useLanguage();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16 font-sans">
      
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-brand-caramel-subtle text-brand-caramel text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
          <Heart className="w-3.5 h-3.5 fill-brand-strawberry/20 text-brand-strawberry" />
          <span>{lang === 'bn' ? 'আমাদের গল্প ও দর্শন' : 'Our Story & Philosophy'}</span>
        </div>
        <h1 className="font-heading text-4xl sm:text-6xl font-semibold text-brand-chocolate tracking-tight">
          {t('about.title')}
        </h1>
        <p className="text-sm sm:text-base text-brand-taupe leading-[1.78]">
          {t('about.subtitle')}
        </p>
      </div>

      {/* Brand Emblem Feature: Velvet espresso with soft warm text */}
      <div className="relative rounded-3xl overflow-hidden bg-caramel-gradient p-8 sm:p-14 text-white flex flex-col md:flex-row items-center gap-10 shadow-float border border-white/10">
        
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-gold/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl shrink-0 bg-white gold-glow">
          <Image
            src="/sweet-cravings-logo.jpg"
            alt="Sweet Cravings Brand Emblem"
            fill
            className="object-cover"
          />
        </div>

        <div className="space-y-4 text-center md:text-left z-10">
          <div className="inline-block bg-white/10 text-brand-gold-light text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
            Rajshahi, Bangladesh
          </div>
          <p className="font-editorial text-2xl sm:text-3xl text-brand-gold-light italic tracking-normal">
            {lang === 'bn' ? '“একটু মিষ্টি, অনেকটা আনন্দ।”' : '“A Little Sweetness, A Lot of Happiness.”'}
          </p>
          <p className="text-sm sm:text-base text-brand-cream-subtle/85 leading-relaxed font-normal">
            {t('about.storyP1')}
          </p>
          <p className="text-sm text-brand-cream-subtle/80 leading-relaxed font-normal">
            {t('about.storyP2')}
          </p>
        </div>
      </div>

      {/* 4 Pillars of Excellence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-brand-cream-dark shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-caramel-subtle text-brand-caramel flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-base text-brand-chocolate">100% Real Dairy</h3>
          <p className="text-xs text-brand-taupe leading-relaxed">
            Only genuine cow milk, dairy butter, and high-fat cream. We never use dalda or artificial fats.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-brand-cream-dark shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-forest-light text-brand-forest flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-base text-brand-chocolate">Small-Batch Fresh</h3>
          <p className="text-xs text-brand-taupe leading-relaxed">
            Every creation is prepared specifically for your order confirmation. Never pre-made or frozen.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-brand-cream-dark shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-cream-subtle text-brand-caramel flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-base text-brand-chocolate">Gourmet Ingredients</h3>
          <p className="text-xs text-brand-taupe leading-relaxed">
            Imported Dutch cocoa powder, Belgian chocolate, and pure vanilla extract for true flavor depth.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-brand-cream-dark shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-strawberry-light text-brand-strawberry flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-heading font-bold text-base text-brand-chocolate">Surgical Hygiene</h3>
          <p className="text-xs text-brand-taupe leading-relaxed">
            Prepared in a sanitized home kitchen environment with food-grade temperature-safe packaging.
          </p>
        </div>
      </div>

      {/* Kitchen Standards Checklist */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-brand-cream-dark shadow-soft space-y-8">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-caramel">
            Commitment to Purity
          </span>
          <h2 className="font-heading text-2xl sm:text-4xl font-bold text-brand-chocolate">
            {t('about.standardsTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-brand-taupe">
            {lang === 'bn' ? 'খাবারের মান ও স্বাস্থ্যবিধিতে আমরা আপসহীন' : 'Zero compromises on hygiene & ingredient integrity'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-brand-cream-subtle/50 border border-brand-cream-dark">
            <CheckCircle2 className="w-5 h-5 text-brand-forest shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-brand-chocolate">{t('about.standards1')}</p>
              <p className="text-xs text-brand-taupe mt-0.5">Every ingredient is inspected and certified clean.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-brand-cream-subtle/50 border border-brand-cream-dark">
            <CheckCircle2 className="w-5 h-5 text-brand-forest shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-brand-chocolate">{t('about.standards2')}</p>
              <p className="text-xs text-brand-taupe mt-0.5">Prepared exclusively after order confirmation.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-brand-cream-subtle/50 border border-brand-cream-dark">
            <CheckCircle2 className="w-5 h-5 text-brand-forest shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-brand-chocolate">{t('about.standards3')}</p>
              <p className="text-xs text-brand-taupe mt-0.5">Dispatched in insulated, chilled containers.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-brand-cream-subtle/50 border border-brand-cream-dark">
            <CheckCircle2 className="w-5 h-5 text-brand-forest shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-brand-chocolate">{t('about.standards4')}</p>
              <p className="text-xs text-brand-taupe mt-0.5">Full accountability with sister-led craftsmanship.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center pt-4">
        <Link
          href="/menu"
          className="inline-flex items-center gap-2.5 bg-brand-caramel hover:bg-brand-caramel-dark text-white font-bold py-4 px-9 rounded-full shadow-card hover:shadow-card-hover transition-all text-sm btn-press"
        >
          <span>{t('hero.ctaMenu')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}
