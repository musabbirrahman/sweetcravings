import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('\n❌ ERROR: Turso environment variables are missing!');
  console.error('Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your environment or .env file.\n');
  console.error('Example:');
  console.error('  TURSO_DATABASE_URL="libsql://sweetcravings-yourorg.turso.io"');
  console.error('  TURSO_AUTH_TOKEN="ey..."\n');
  process.exit(1);
}

console.log('🔄 Connecting to Turso LibSQL at:', url);
const client = createClient({ url, authToken });

async function migrate() {
  console.log('📦 Creating tables and indexes in Turso...');

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      description_en TEXT,
      description_bn TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      sort_order INTEGER DEFAULT 0,
      base_price INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      description_en TEXT,
      description_bn TEXT,
      ingredients_en TEXT,
      ingredients_bn TEXT,
      allergens_en TEXT,
      allergens_bn TEXT,
      lead_time_en TEXT,
      lead_time_bn TEXT,
      image_url TEXT,
      daily_batch_limit INTEGER DEFAULT 15,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );`,
    `CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      label_en TEXT NOT NULL,
      label_bn TEXT NOT NULL,
      sku TEXT,
      price_adjustment INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      area_landmark TEXT NOT NULL,
      delivery_instructions TEXT,
      requested_time TEXT,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      order_status TEXT NOT NULL DEFAULT 'new',
      subtotal INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL,
      discount_amount INTEGER DEFAULT 0,
      coupon_code TEXT,
      total_amount INTEGER NOT NULL,
      is_gift INTEGER DEFAULT 0,
      recipient_name TEXT,
      recipient_phone TEXT,
      gift_message TEXT,
      idempotency_token TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name_en TEXT NOT NULL,
      product_name_bn TEXT NOT NULL,
      variant_label_en TEXT,
      variant_label_bn TEXT,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS payment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      transaction_ref TEXT NOT NULL,
      claimed_amount INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      review_state TEXT DEFAULT 'pending',
      reviewer TEXT,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS order_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      acting_admin TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS shop_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT DEFAULT 'system'
    );`,
    `CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value INTEGER NOT NULL,
      min_order_amount INTEGER DEFAULT 0,
      max_discount_amount INTEGER,
      usage_limit INTEGER,
      times_used INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_orders_public_code ON orders(public_code);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);`,
    `CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);`
  ];

  for (const stmt of schemaStatements) {
    await client.execute(stmt);
  }

  console.log('✅ Schema & indexes synchronized successfully!');

  // Seed default coupons if not present
  const couponCheck = await client.execute('SELECT COUNT(*) as count FROM coupons');
  const count = Number(couponCheck.rows[0].count);
  if (count === 0) {
    console.log('🌱 Seeding initial coupons...');
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, times_used, active, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1, NULL, ?)`,
      args: ['WELCOME50', 'fixed', 50, 400, null, 100, now]
    });
    await client.execute({
      sql: `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, times_used, active, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1, NULL, ?)`,
      args: ['SWEETREWARD', 'fixed', 150, 200, null, 5000, now]
    });
  }

  console.log('🎉 Turso cloud database is ready for 100% Free Vercel Serverless Hosting!');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
