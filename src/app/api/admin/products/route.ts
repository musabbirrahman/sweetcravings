import { NextResponse } from 'next/server';
import { getProducts, getCategories, getDb } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const products = getProducts({ includeArchived: true });
    const categories = getCategories(true);
    return NextResponse.json({ success: true, products, categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const body = await request.json();
    const {
      categoryId,
      slug,
      nameEn,
      nameBn,
      descriptionEn,
      descriptionBn,
      ingredientsEn,
      ingredientsBn,
      allergensEn,
      allergensBn,
      leadTimeEn,
      leadTimeBn,
      basePrice,
      imageUrl,
      variants,
    } = body;

    if (!nameEn || !nameBn || !basePrice || !categoryId) {
      return NextResponse.json({ success: false, error: 'Name, price, and category are required' }, { status: 400 });
    }

    const db = getDb();
    const finalSlug = slug || nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO products (
        category_id, slug, status, sort_order, base_price,
        name_en, name_bn, description_en, description_bn,
        ingredients_en, ingredients_bn, allergens_en, allergens_bn,
        lead_time_en, lead_time_bn, image_url, created_at, updated_at
      ) VALUES (?, ?, 'published', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      categoryId,
      finalSlug,
      parseInt(basePrice, 10),
      nameEn,
      nameBn,
      descriptionEn || '',
      descriptionBn || '',
      ingredientsEn || '',
      ingredientsBn || '',
      allergensEn || '',
      allergensBn || '',
      leadTimeEn || '2-4 hours',
      leadTimeBn || '২-৪ ঘন্টা',
      imageUrl || '/sweet-cravings-logo.jpg',
      now,
      now
    );

    const productId = Number(result.lastInsertRowid);

    // Variants
    if (variants && Array.isArray(variants)) {
      const varInsert = db.prepare(`
        INSERT INTO product_variants (product_id, label_en, label_bn, sku, price_adjustment, active, sort_order)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `);
      variants.forEach((v: any, idx: number) => {
        if (v.labelEn && v.labelBn) {
          varInsert.run(productId, v.labelEn, v.labelBn, v.sku || '', parseInt(v.priceAdjustment || 0, 10), idx);
        }
      });
    }

    db.prepare(`
      INSERT INTO audit_log (actor, action, entity, details, created_at)
      VALUES ('admin', 'CREATE_PRODUCT', 'product_${productId}', ?, ?)
    `).run(`Created ${nameEn}`, now);

    return NextResponse.json({ success: true, productId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, basePrice, nameEn, nameBn, leadTimeEn, leadTimeBn, imageUrl, dailyBatchLimit } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Quick status toggle (e.g. published <-> sold_out)
    if (status) {
      db.prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
      db.prepare('INSERT INTO audit_log (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)').run('admin', 'UPDATE_PRODUCT_STATUS', `product_${id}`, `Status changed to ${status}`, now);
      return NextResponse.json({ success: true, status });
    }

    // Daily batch limit update
    if (dailyBatchLimit !== undefined) {
      db.prepare('UPDATE products SET daily_batch_limit = ?, updated_at = ? WHERE id = ?').run(parseInt(dailyBatchLimit, 10), now, id);
      db.prepare('INSERT INTO audit_log (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)').run('admin', 'UPDATE_BATCH_LIMIT', `product_${id}`, `Daily limit set to ${dailyBatchLimit}`, now);
      return NextResponse.json({ success: true, dailyBatchLimit });
    }

    // Full update
    db.prepare(`
      UPDATE products
      SET base_price = COALESCE(?, base_price),
          name_en = COALESCE(?, name_en),
          name_bn = COALESCE(?, name_bn),
          lead_time_en = COALESCE(?, lead_time_en),
          lead_time_bn = COALESCE(?, lead_time_bn),
          image_url = COALESCE(?, image_url),
          updated_at = ?
      WHERE id = ?
    `).run(basePrice ? parseInt(basePrice, 10) : null, nameEn, nameBn, leadTimeEn, leadTimeBn, imageUrl, now, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Safe Soft Archive: Preserve historical order records!
    db.prepare(`UPDATE products SET status = 'archived', updated_at = ? WHERE id = ?`).run(now, id);
    db.prepare(`INSERT INTO audit_log (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)`).run('admin', 'ARCHIVE_PRODUCT', `product_${id}`, 'Product soft archived', now);

    return NextResponse.json({ success: true, message: 'Product archived safely.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
