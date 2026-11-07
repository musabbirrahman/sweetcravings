'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, MessageCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center font-sans">
      <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl border border-brand-cream-dark shadow-soft space-y-6">
        
        <div className="w-16 h-16 mx-auto rounded-full bg-brand-strawberry-light text-brand-strawberry flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-brand-chocolate">
            Something Went Wrong
          </h1>
          <p className="text-xs sm:text-sm text-brand-taupe leading-relaxed">
            We encountered an unexpected issue while loading this page. Our kitchen team has been alerted.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-caramel hover:bg-brand-caramel-dark text-white font-bold px-6 py-3 rounded-full text-xs sm:text-sm shadow-soft transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <a
            href="https://wa.me/8801712345678?text=Salam!%20I%20experienced%20an%20error%20on%20the%20Sweet%20Cravings%20website."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-forest hover:bg-[#1A3F2C] text-white font-bold px-6 py-3 rounded-full text-xs sm:text-sm shadow-soft transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Support</span>
          </a>
        </div>

      </div>
    </div>
  );
}
