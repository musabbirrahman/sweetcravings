import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Home, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center font-sans">
      <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-3xl border border-brand-cream-dark shadow-soft space-y-6">
        
        {/* Brand Emblem */}
        <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden border border-brand-cream-dark shadow-xs bg-brand-cream-subtle">
          <Image
            src="/sweet-cravings-logo.jpg"
            alt="Sweet Cravings"
            fill
            className="object-cover"
          />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-caramel bg-brand-caramel-subtle px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>404 • Page Not Found</span>
          </span>
          <h1 className="font-heading text-3xl font-bold text-brand-chocolate">
            This Sweet Page is Missing
          </h1>
          <p className="text-xs sm:text-sm text-brand-taupe leading-relaxed">
            The page you are looking for may have been moved, renamed, or is currently taking a fresh baking break!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-cream-subtle hover:bg-brand-cream text-brand-chocolate font-bold px-6 py-3 rounded-full text-xs sm:text-sm border border-brand-cream-dark transition-all"
          >
            <Home className="w-4 h-4 text-brand-caramel" />
            <span>Home</span>
          </Link>

          <Link
            href="/menu"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-caramel hover:bg-brand-caramel-dark text-white font-bold px-6 py-3 rounded-full text-xs sm:text-sm shadow-soft transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Browse Menu</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
