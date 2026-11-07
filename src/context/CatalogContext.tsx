'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Product, Category, ShopSettings } from '@/lib/types';

interface CatalogData {
  products: Product[];
  categories: Category[];
  settings: ShopSettings | null;
}

interface CatalogContextType extends CatalogData {
  loading: boolean;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

// One fetch per page load, shared by every component that needs the
// catalogue (navbar, footer, cart, home, menu, checkout, contact, admin).
// Before this provider, nine components each fetched /api/products on
// every page — the same ~19 KB JSON four or five times per page.
// The module-level cache also survives React StrictMode's double effect
// run in development, so the fetch still happens exactly once.
let cachedData: CatalogData | null = null;
let inflight: Promise<CatalogData> | null = null;

async function loadCatalogue(): Promise<CatalogData> {
  if (cachedData) return cachedData;
  if (!inflight) {
    inflight = fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        const loaded: CatalogData = {
          products: data.products || [],
          categories: data.categories || [],
          settings: data.settings || null,
        };
        cachedData = loaded;
        return loaded;
      })
      .catch(() => ({ products: [], categories: [], settings: null }))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CatalogData>({ products: [], categories: [], settings: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadCatalogue().then((loaded) => {
      if (alive) {
        setData(loaded);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    cachedData = null;
    const loaded = await loadCatalogue();
    setData(loaded);
  }, []);

  return (
    <CatalogContext.Provider value={{ ...data, loading, refresh }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
