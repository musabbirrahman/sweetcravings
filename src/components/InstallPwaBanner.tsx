'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, X, Share } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPwaBanner() {
  const { lang } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default true until client check
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (typeof window !== 'undefined') {
      const isRunningStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      setIsStandalone(isRunningStandalone);

      // Check iOS
      const ua = window.navigator.userAgent.toLowerCase();
      const isAppleDevice = /iphone|ipad|ipod/.test(ua);
      setIsIOS(isAppleDevice);

      // Check if user dismissed recently (within 7 days)
      const dismissedTimestamp = localStorage.getItem('sc_pwa_dismissed');
      if (dismissedTimestamp) {
        const diffDays = (Date.now() - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) {
          setDismissed(true);
          return;
        }
      }

      // Listen for Chrome/Android install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setDismissed(false);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // If iOS Safari and not standalone, show prompt after 4 seconds
      if (isAppleDevice && !isRunningStandalone && !dismissedTimestamp) {
        const timer = setTimeout(() => {
          setDismissed(false);
        }, 4000);
        return () => {
          clearTimeout(timer);
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
      }

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDismissed(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sc_pwa_dismissed', Date.now().toString());
    }
  };

  if (isStandalone || dismissed) {
    return null;
  }

  return (
    <aside 
      aria-label="PWA install banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-fade-in"
    >
      <div className="bg-[#2C1E19] text-white rounded-2xl shadow-elevated border border-brand-caramel/30 p-4 relative backdrop-blur-md">
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 text-white/50 hover:text-white rounded-full transition-colors"
          aria-label="Close install banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-brand-caramel/40 shadow-sm">
            <Image
              src="/sweet-cravings-logo.jpg"
              alt="Sweet Cravings"
              fill
              className="object-cover"
              sizes="44px"
            />
          </div>

          <div className="flex-1 pr-4">
            <h4 className="font-bold text-sm text-brand-gold-light leading-snug">
              {lang === 'bn' ? 'সরাসরি অ্যাপে অর্ডার করুন' : 'Install Sweet Cravings App'}
            </h4>
            <p className="text-[12px] text-brand-cream/80 leading-tight mt-0.5">
              {lang === 'bn' 
                ? 'দ্রুত রি-অর্ডার ও লাইভ ট্র্যাক করতে হোম স্ক্রিনে অ্যাপ যুক্ত করুন।'
                : 'Add to home screen for faster ordering & live delivery tracking in Rajshahi.'}
            </p>

            {showIOSGuide ? (
              <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-brand-cream/90 space-y-1">
                <p className="flex items-center gap-1 font-semibold text-brand-gold-light">
                  <Share className="w-3.5 h-3.5" />
                  <span>Safari Install Instructions:</span>
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-white/80">
                  <li>Tap the <strong>Share</strong> button at bottom</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                </ol>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="bg-brand-caramel hover:bg-brand-caramel-dark text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-soft flex items-center gap-1.5 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'অ্যাপ নিন' : 'Install App'}</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-white/60 hover:text-white px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                >
                  {lang === 'bn' ? 'পরে' : 'Maybe Later'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
