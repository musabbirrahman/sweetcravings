import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Backup restore. The backup file (see GET /api/admin/settings?backup=true)
// holds every table except coupons, which are not exported and are left
// untouched by a restore. Nothing is changed until the file has passed
// strict validation; a failed validation or a failed insert leaves the
// live database exactly as it was.

const REQUIRED_ARRAYS = [
  'categories',
  'products',
  'variants',
  'orders',
  'orderItems',
  'paymentSubmissions',
  'events',
  'settings',
  'auditLog',
] as const;

type Row = Record<string, unknown>;

function isRow(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isInt(v: unknown): v is number {
  return isNumber(v) && Number.isInteger(v);
}

// Columns the restore is allowed to write, per table. Anything else in
// the file is ignored, so a tampered file cannot smuggle in new columns.
const COLUMNS: Record<string, string[]> = {
  categories: ['id', 'slug', 'sort_order', 'active', 'name_en', 'name_bn', 'description_en', 'description_bn'],
  products: [
    'id', 'category_id', 'slug', 'status', 'sort_order', 'base_price',
    'name_en', 'name_bn', 'description_en', 'description_bn',
    'ingredients_en', 'ingredients_bn', 'allergens_en', 'allergens_bn',
    'lead_time_en', 'lead_time_bn', 'image_url', 'daily_batch_limit',
    'created_at', 'updated_at',
  ],
  variants: ['id', 'product_id', 'label_en', 'label_bn', 'sku', 'price_adjustment', 'active', 'sort_order'],
  orders: [
    'id', 'public_code', 'customer_name', 'customer_phone', 'delivery_address',
    'area_landmark', 'delivery_instructions', 'requested_time', 'payment_method',
    'payment_status', 'order_status', 'subtotal', 'delivery_fee', 'discount_amount',
    'coupon_code', 'total_amount', 'is_gift', 'recipient_name', 'recipient_phone', 'gift_message',
    'idempotency_token', 'created_at', 'updated_at',
  ],
  orderItems: [
    'id', 'order_id', 'product_id', 'product_name_en', 'product_name_bn',
    'variant_label_en', 'variant_label_bn', 'unit_price', 'quantity', 'line_total',
  ],
  paymentSubmissions: [
    'id', 'order_id', 'provider', 'transaction_ref', 'claimed_amount',
    'submitted_at', 'reviewed_at', 'review_state', 'reviewer',
  ],
  events: ['id', 'order_id', 'from_status', 'to_status', 'acting_admin', 'note', 'created_at'],
  settings: ['key', 'value', 'updated_at', 'updated_by'],
  auditLog: ['id', 'actor', 'action', 'entity', 'details', 'created_at'],
};

// Required fields per table (name in the backup file -> check).
const REQUIRED: Record<string, Array<[string, (v: unknown) => boolean]>> = {
  categories: [['slug', isNonEmptyString], ['name_en', isNonEmptyString], ['name_bn', isNonEmptyString]],
  products: [
    ['slug', isNonEmptyString],
    ['name_en', isNonEmptyString],
    ['name_bn', isNonEmptyString],
    ['base_price', isInt],
    ['category_id', isInt],
    ['status', (v) => typeof v === 'string' && ['published', 'sold_out', 'archived', 'draft'].includes(v)],
  ],
  variants: [['product_id', isInt], ['label_en', isNonEmptyString], ['label_bn', isNonEmptyString]],
  orders: [
    ['public_code', isNonEmptyString],
    ['customer_name', isNonEmptyString],
    ['customer_phone', isNonEmptyString],
    ['total_amount', isInt],
    ['order_status', isNonEmptyString],
    ['payment_method', (v) => typeof v === 'string' && ['cod', 'bkash', 'nagad'].includes(v)],
  ],
  orderItems: [
    ['order_id', isInt],
    ['product_name_en', isNonEmptyString],
    ['unit_price', isInt],
    ['quantity', isInt],
  ],
  paymentSubmissions: [['order_id', isInt], ['provider', isNonEmptyString], ['transaction_ref', isNonEmptyString]],
  events: [['order_id', isInt], ['from_status', isNonEmptyString], ['to_status', isNonEmptyString]],
  settings: [['key', isNonEmptyString], ['value', (v) => typeof v === 'string']],
  auditLog: [['actor', isNonEmptyString], ['action', isNonEmptyString], ['entity', isNonEmptyString]],
};

function validateBackup(parsed: unknown): { ok: true; data: Record<string, Row[]> } | { ok: false; error: string } {
  if (!isRow(parsed)) return { ok: false, error: 'This is not a Sweet Cravings backup file (expected a JSON object).' };
  if (parsed.version !== undefined && typeof parsed.version !== 'string') {
    return { ok: false, error: 'This backup file has an unreadable version.' };
  }
  const data = parsed.data;
  if (!isRow(data)) return { ok: false, error: 'This is not a Sweet Cravings backup file (missing the data section).' };

  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(data[key])) {
      return { ok: false, error: `This backup file is incomplete: the "${key}" section is missing.` };
    }
    for (const row of data[key] as unknown[]) {
      if (!isRow(row)) return { ok: false, error: `The "${key}" section contains a broken entry.` };
    }
  }

  // Required fields + types, per table.
  for (const key of REQUIRED_ARRAYS) {
    const rows = data[key] as Row[];
    for (let i = 0; i < rows.length; i++) {
      for (const [field, check] of REQUIRED[key]) {
        if (!check(rows[i][field])) {
          return { ok: false, error: `The "${key}" section has an entry (#${i + 1}) with a missing or invalid "${field}".` };
        }
      }
    }
  }

  // Unique values that must not repeat inside the file.
  const seen = (rows: Row[], field: string, label: string): string | null => {
    const set = new Set<unknown>();
    for (const r of rows) {
      if (set.has(r[field])) return `The backup contains two ${label} with the same ${field} ("${String(r[field])}").`;
      set.add(r[field]);
    }
    return null;
  };
  const dupes =
    seen(data.categories as Row[], 'slug', 'categories') ||
    seen(data.products as Row[], 'slug', 'products') ||
    seen(data.orders as Row[], 'public_code', 'orders') ||
    seen(data.settings as Row[], 'key', 'settings');
  if (dupes) return { ok: false, error: dupes };

  // References between tables must resolve inside the file.
  const categoryIds = new Set((data.categories as Row[]).map((r) => r.id));
  const productIds = new Set((data.products as Row[]).map((r) => r.id));
  const orderIds = new Set((data.orders as Row[]).map((r) => r.id));
  for (const p of data.products as Row[]) {
    if (!categoryIds.has(p.category_id)) {
      return { ok: false, error: `A product ("${String(p.slug)}") refers to a category that is not in this backup.` };
    }
  }
  for (const v of data.variants as Row[]) {
    if (!productIds.has(v.product_id)) {
      return { ok: false, error: 'A product option refers to a dessert that is not in this backup.' };
    }
  }
  for (const key of ['orderItems', 'paymentSubmissions', 'events'] as const) {
    for (const r of data[key] as Row[]) {
      if (!orderIds.has(r.order_id)) {
        return { ok: false, error: `An entry in "${key}" refers to an order that is not in this backup.` };
      }
    }
  }

  return { ok: true, data: data as Record<string, Row[]> };
}

export async function POST(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('backup');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Please choose a backup JSON file to restore.' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'That backup file is too large (over 20 MB).' }, { status: 400 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return NextResponse.json({ success: false, error: 'That file is not valid JSON. Please choose a backup file downloaded from this shop.' }, { status: 400 });
    }

    // Strict validation first: nothing is written until the file passes.
    const validation = validateBackup(parsed);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }
    const data = validation.data;

    const db = getDb();
    const now = new Date().toISOString();
    const counts: Record<string, number> = {};

    // One transaction: either everything is restored, or nothing changes.
    db.exec('BEGIN TRANSACTION;');
    try {
      // Delete children first, parents last (foreign keys are on).
      for (const table of ['order_items', 'payment_submissions', 'order_status_events', 'orders', 'product_variants', 'products', 'categories', 'shop_settings', 'audit_log']) {
        db.prepare(`DELETE FROM ${table}`).run();
      }

      const tableMap: Array<[string, string]> = [
        ['categories', 'categories'],
        ['products', 'products'],
        ['variants', 'product_variants'],
        ['orders', 'orders'],
        ['orderItems', 'order_items'],
        ['paymentSubmissions', 'payment_submissions'],
        ['events', 'order_status_events'],
        ['settings', 'shop_settings'],
        ['auditLog', 'audit_log'],
      ];

      for (const [fileKey, table] of tableMap) {
        const rows = data[fileKey] as Row[];
        const cols = COLUMNS[fileKey];
        const placeholders = cols.map(() => '?').join(', ');
        const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
        for (const row of rows) {
          stmt.run(...cols.map((c) => {
            const v = row[c];
            return v === undefined ? null : v;
          }));
        }
        counts[fileKey] = rows.length;
      }

      // Record the restore itself in the audit log.
      db.prepare(`
        INSERT INTO audit_log (actor, action, entity, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('admin', 'RESTORE_BACKUP', 'database', `Restored backup "${file.name}" (${now})`, now);

      db.exec('COMMIT;');
    } catch (txErr) {
      try { db.exec('ROLLBACK;'); } catch {}
      throw txErr;
    }

    return NextResponse.json({
      success: true,
      message: `Backup restored: ${counts.orders ?? 0} orders, ${counts.products ?? 0} desserts, ${counts.categories ?? 0} categories. Coupons were not part of the backup and were left as they were.`,
      counts,
    });
  } catch (error: any) {
    console.error('Backup restore error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Restore failed.' }, { status: 500 });
  }
}
