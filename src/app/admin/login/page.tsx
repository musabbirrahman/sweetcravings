'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { lang, t } = useLanguage();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/admin');
      } else {
        setError(data.error || (lang === 'bn' ? 'ভুল পাসওয়ার্ড' : 'Incorrect password'));
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-brand-cream-dark shadow-soft space-y-6 text-center">
        
        {/* Brand Logo */}
        <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border border-brand-cream-dark shadow-sm bg-brand-cream-subtle">
          <Image
            src="/sweet-cravings-logo.jpg"
            alt="Sweet Cravings"
            fill
            className="object-cover"
          />
        </div>

        <div>
          <h1 className="font-heading text-2xl font-semibold text-brand-chocolate">
            {t('admin.loginTitle')}
          </h1>
          <p className="text-xs text-brand-taupe mt-1 leading-relaxed">
            {t('admin.loginSubtitle')}
          </p>
        </div>

        {error && (
          <div className="bg-brand-strawberry-light border border-brand-strawberry/20 text-brand-strawberry text-xs p-3 rounded-xl flex items-center justify-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe/50" />
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('admin.passwordPlaceholder')}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-cream-dark bg-brand-cream-subtle/50 focus:bg-white focus:outline-none focus:border-brand-caramel text-center tracking-widest text-lg font-mono font-bold text-brand-chocolate"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-caramel hover:bg-brand-caramel-dark text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-soft transition-all"
          >
            <span>{loading ? 'Verifying...' : t('admin.loginBtn')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
