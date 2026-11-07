import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, getRelatedProducts } from '@/lib/db';
import ProductDetailView from '@/components/ProductDetailView';

interface ProductPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = getProductBySlug(params.slug);
  if (!product) {
    return { title: 'Dessert Not Found — Sweet Cravings' };
  }
  return {
    title: `${product.name_en} — Sweet Cravings`,
    description: product.description_en || `Order ${product.name_en}, homemade in Rajshahi.`,
    openGraph: {
      title: `${product.name_en} — Sweet Cravings`,
      description: product.description_en || undefined,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug(params.slug);

  // Unknown slug: proper 404 page.
  if (!product) {
    notFound();
  }

  // Non-published products (sold out, archived, draft) still render, but
  // the detail view shows them as unavailable with no add-to-cart.
  // Ordering them is blocked server-side in POST /api/orders.
  // NOTE: rows from node:sqlite carry a null prototype, which Next.js
  // refuses to pass to a Client Component — serialize to a plain object.
  const related = getRelatedProducts(product);
  return (
    <ProductDetailView
      product={JSON.parse(JSON.stringify(product))}
      related={JSON.parse(JSON.stringify(related))}
    />
  );
}
