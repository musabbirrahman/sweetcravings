'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '@/lib/types';
import { translations } from '@/lib/translations';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (path: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('bn'); // Default to Bangla for Rajshahi local touch

  useEffect(() => {
    const saved = localStorage.getItem('sc_lang') as Language | null;
    if (saved === 'en' || saved === 'bn') {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('sc_lang', newLang);
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'bn' : 'en');
  };

  // Safe nested translation lookup
  const t = (path: string, fallback: string = ''): string => {
    const keys = path.split('.');
    let curr: any = translations[lang];
    for (const k of keys) {
      if (curr && typeof curr === 'object' && k in curr) {
        curr = curr[k];
      } else {
        // Fallback to English if missing in current locale
        let enCurr: any = translations.en;
        for (const enK of keys) {
          if (enCurr && typeof enCurr === 'object' && enK in enCurr) {
            enCurr = enCurr[enK];
          } else {
            return fallback || path;
          }
        }
        return typeof enCurr === 'string' ? enCurr : fallback || path;
      }
    }
    return typeof curr === 'string' ? curr : fallback || path;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
