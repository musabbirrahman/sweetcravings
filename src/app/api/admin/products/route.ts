import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getProducts, getCategories, getDb, runInTransaction } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-products:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
      { status: 429 }
    );
  }
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const products = await getProducts({ includeArchived: true });
    const categories = await getCategories(true);
    return NextResponse.json({ success: true, products, categories });
  } catch (error: any) {
    console.error('Admin products error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-products:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
      { status: 429 }
    );
  }
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

    const db = await getDb();
    const finalSlug = slug || nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = new Date().toISOString();

    const insert = await db.prepare(`
      INSERT INTO products (
        category_id, slug, status, sort_order, base_price,
        name_en, name_bn, description_en, description_bn,
        ingredients_en, ingredients_bn, allergens_en, allergens_bn,
        lead_time_en, lead_time_bn, image_url, created_at, updated_at
      ) VALUES (?, ?, 'published', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
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
      const varInsert = await db.prepare(`
        INSERT INTO product_variants (product_id, label_en, label_bn, sku, price_adjustment, active, sort_order)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `);
      for (let idx = 0; idx < variants.length; idx++) {
        const v = variants[idx] as any;
        if (v.labelEn && v.labelBn) {
          await varInsert.run(productId, v.labelEn, v.labelBn, v.sku || '', parseInt(v.priceAdjustment || 0, 10), idx);
        }
      }
    }

    await db.prepare(`
      INSERT INTO audit_log (actor, action, entity, details, created_at)
      VALUES ('admin', 'CREATE_PRODUCT', 'product_${productId}', ?, ?)
    `).run(`Created ${nameEn}`, now);

    return NextResponse.json({ success: true, productId });
  } catch (error: any) {
    console.error('Admin products error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-products:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
      { status: 429 }
    );
  }
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      status,
      basePrice,
      nameEn,
      nameBn,
      categoryId,
      descriptionEn,
      descriptionBn,
      ingredientsEn,
      ingredientsBn,
      allergensEn,
      allergensBn,
      leadTimeEn,
      leadTimeBn,
      imageUrl,
      dailyBatchLimit,
      variants,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const hasFullUpdateFields =
      basePrice !== undefined || nameEn !== undefined || nameBn !== undefined ||
      categoryId !== undefined || descriptionEn !== undefined || descriptionBn !== undefined ||
      ingredientsEn !== undefined || ingredientsBn !== undefined ||
      allergensEn !== undefined || allergensBn !== undefined ||
      leadTimeEn !== undefined || leadTimeBn !== undefined ||
      imageUrl !== undefined || variants !== undefined;

    // Quick status toggle (e.g. published <-> sold_out) — only when the
    // request carries no other changes, so a full edit that also sets a
    // status cannot silently drop the rest of the form.
    if (status && !hasFullUpdateFields && dailyBatchLimit === undefined) {
      if (!['published', 'sold_out', 'draft', 'archived'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      }
      await db.prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
      await db.prepare('INSERT INTO audit_log (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)').run('admin', 'UPDATE_PRODUCT_STATUS', `product_${id}`, `Status changed to ${status}`, now);
      return NextResponse.json({ success: true, status });
    }

    // Daily batch limit update — only when it is the only change.
    if (dailyBatchLimit !== undefined && !hasFullUpdateFields && !status) {
      const limit = parseInt(dailyBatchLimit, 10);
      if (isNaN(limit) || limit < 0) {
        return NextResponse.json({ success: false, error: 'Daily batch limit must be 0 or more' }, { status: 400 });
      }
      await db.prepare('UPDATE products SET daily_batch_limit = ?, updated_at = ? WHERE id = ?').run(limit, now, id);
      await db.prepare('INSERT INTO audit_log (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)').run('admin', 'UPDATE_BATCH_LIMIT', `product_${id}`, `Daily limit set to ${limit}`, now);
      return NextResponse.json({ success: true, dailyBatchLimit: limit });
    }

    // Full update — every field of the edit form, validated server-side.
    if (nameEn !== undefined && !String(nameEn).trim()) {
      return NextResponse.json({ success: false, error: 'English name cannot be empty' }, { status: 400 });
    }
    if (nameBn !== undefined && !String(nameBn).trim()) {
      return NextResponse.json({ success: false, error: 'Bangla name cannot be empty' }, { status: 400 });
    }
    if (basePrice !== undefined && (isNaN(parseInt(basePrice, 10)) || parseInt(basePrice, 10) < 0)) {
      return NextResponse.json({ success: false, error: 'Price must be 0 or more' }, { status: 400 });
    }
    if (categoryId !== undefined) {
      const cat = await db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(categoryId));
      if (!cat) {
        return NextResponse.json({ success: false, error: 'That category does not exist' }, { status: 400 });
      }
    }
    if (status && !['published', 'sold_out', 'draft', 'archived'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }
    if (variants !== undefined) {
      if (!Array.isArray(variants)) {
        return NextResponse.json({ success: false, error: 'Sizes must be a list' }, { status: 400 });
      }
      for (const v of variants) {
        if (!v?.labelEn?.trim() || !v?.labelBn?.trim()) {
          return NextResponse.json({ success: false, error: 'Each size needs an English and a Bangla name' }, { status: 400 });
        }
        if (v.priceAdjustment !== undefined && isNaN(parseInt(v.priceAdjustment, 10))) {
          return NextResponse.json({ success: false, error: 'Size price must be a number' }, { status: 400 });
        }
      }
    }

    // One transaction: the product row, its sizes and the audit row all
    // land together or not at all (runInTransaction, src/lib/db.ts).
    await runInTransaction(db, async () => {
      await db.prepare(`
        UPDATE products
        SET category_id = COALESCE(?, category_id),
            base_price = COALESCE(?, base_price),
            name_en = COALESCE(?, name_en),
            name_bn = COALESCE(?, name_bn),
            description_en = COALESCE(?, description_en),
            description_bn = COALESCE(?, description_bn),
            ingredients_en = COALESCE(?, ingredients_en),
            ingredients_bn = COALESCE(?, ingredients_bn),
            allergens_en = COALESCE(?, allergens_en),
            allergens_bn = COALESCE(?, allergens_bn),
            lead_time_en = COALESCE(?, lead_time_en),
            lead_time_bn = COALESCE(?, lead_time_bn),
            image_url = COALESCE(?, image_url),
            status = COALESCE(?, status),
            updated_at = ?
        WHERE id = ?
      `).run(
        categoryId !== undefined ? Number(categoryId) : null,
        basePrice !== undefined ? parseInt(basePrice, 10) : null,
        nameEn?.trim() || null,
        nameBn?.trim() || null,
        descriptionEn ?? null,
        descriptionBn ?? null,
        ingredientsEn ?? null,
        ingredientsBn ?? null,
        allergensEn ?? null,
        allergensBn ?? null,
        leadTimeEn ?? null,
        leadTimeBn ?? null,
        imageUrl || null,
        status || null,
        now,
        id
      );

      // Sizes are replaced as a set, so a removed size really disappears.
      if (variants !== undefined) {
        await db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
        const varInsert = await db.prepare(`
          INSERT INTO product_variants (product_id, label_en, label_bn, sku, price_adjustment, active, sort_order)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `);
        for (let idx = 0; idx < variants.length; idx++) {
          const v = variants[idx] as any;
          await varInsert.run(id, v.labelEn.trim(), v.labelBn.trim(), v.sku || '', parseInt(v.priceAdjustment || 0, 10), idx);
        }
      }

      await db.prepare('INSERT INTO audit_log (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)').run('admin', 'UPDATE_PRODUCT', `product_${id}`, 'Product updated', now);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin products error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-products:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
      { status: 429 }
    );
  }
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    // Safe Soft Archive: Preserve historical order records!
    await db.prepare(`UPDATE products SET status = 'archived', updated_at = ? WHERE id = ?`).run(now, id);
    await db.prepare(`INSERT INTO audit_log (actor, action, entity, details, created_at) VALUES (?, ?, ?, ?, ?)`).run('admin', 'ARCHIVE_PRODUCT', `product_${id}`, 'Product soft archived', now);

    return NextResponse.json({ success: true, message: 'Product archived safely.' });
  } catch (error: any) {
    console.error('Admin products error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
