import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { CatalogProvider } from '@/context/CatalogContext';
import { CartProvider } from '@/context/CartContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import InstallPwaBanner from '@/components/InstallPwaBanner';
import FloatingMobileCartBar from '@/components/FloatingMobileCartBar';
import FloatingWhatsAppButton from '@/components/FloatingWhatsAppButton';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://sweetcravings-rajshahi.vercel.app'),
  title: 'Sweet Cravings | Homemade Desserts Rajshahi',
  description: 'A Little Sweetness, A Lot of Happiness. Artisanal homemade desserts, signature flans, jar cakes, and gourmet delights delivered across Rajshahi City.',
  keywords: ['Sweet Cravings', 'Rajshahi desserts', 'homemade flan', 'caramel custard', 'jar cakes Rajshahi', 'Rajshahi bakery'],
  manifest: '/manifest.json',
  icons: {
    icon: '/sweet-cravings-logo.jpg',
    apple: '/sweet-cravings-logo.jpg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sweet Cravings',
  },
  openGraph: {
    title: 'Sweet Cravings — Homemade Desserts in Rajshahi',
    description: '“A Little Sweetness, A Lot of Happiness.” Handcrafted with pure butter, cream and love in Rajshahi.',
    images: ['/sweet-cravings-logo.jpg'],
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: 'Sweet Cravings Homemade Desserts',
    description: 'A Little Sweetness, A Lot of Happiness. Artisanal homemade desserts and gourmet flans in Rajshahi.',
    priceRange: '৳220 - ৳1500',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Rajshahi',
      addressRegion: 'Rajshahi Division',
      addressCountry: 'BD',
    },
    servesCuisine: 'Desserts, Flans, Cakes, Artisanal Patisserie',
    paymentAccepted: 'Cash, bKash, Nagad',
    currenciesAccepted: 'BDT',
  };

  return (
    <html lang="bn">
      <head>
        <meta name="theme-color" content="#2C1E19" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-brand-cream text-brand-chocolate antialiased selection:bg-brand-caramel selection:text-white">
        <LanguageProvider>
          <CatalogProvider>
          <CartProvider>
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <CartDrawer />
            <FloatingMobileCartBar />
            <FloatingWhatsAppButton />
            <InstallPwaBanner />
            <Footer />
          </CartProvider>
          </CatalogProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
