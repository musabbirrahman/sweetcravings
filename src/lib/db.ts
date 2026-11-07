import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { 
  Category, 
  Product, 
  ProductVariant, 
  Order, 
  OrderItem, 
  OrderStatusEvent, 
  PaymentSubmission, 
  ShopSettings,
  Coupon,
  LoyaltyInfo 
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'sweetcravings.db');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA foreign_keys = ON;');
    _db.exec('PRAGMA journal_mode = WAL;');
    _db.exec('PRAGMA busy_timeout = 5000;');
    initSchema(_db);
    seedInitialData(_db);
    seedDefaultCoupons(_db);
  }
  return _db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      description_en TEXT,
      description_bn TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'published', -- published, sold_out, archived, draft
      sort_order INTEGER DEFAULT 0,
      base_price INTEGER NOT NULL, -- Integer BDT
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      label_en TEXT NOT NULL,
      label_bn TEXT NOT NULL,
      sku TEXT,
      price_adjustment INTEGER DEFAULT 0, -- Integer BDT delta
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      area_landmark TEXT NOT NULL,
      delivery_instructions TEXT,
      requested_time TEXT,
      payment_method TEXT NOT NULL, -- cod, bkash, nagad
      payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, submitted, confirmed, rejected, refunded
      order_status TEXT NOT NULL DEFAULT 'new', -- new, accepted, preparing, ready, out_for_delivery, completed, cancelled
      subtotal INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      idempotency_token TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
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
    );

    CREATE TABLE IF NOT EXISTS payment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      provider TEXT NOT NULL, -- bkash, nagad, cod
      transaction_ref TEXT NOT NULL,
      claimed_amount INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      review_state TEXT DEFAULT 'pending', -- pending, verified, rejected
      reviewer TEXT,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      acting_admin TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shop_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT DEFAULT 'system'
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL, -- 'fixed' or 'percentage'
      discount_value INTEGER NOT NULL,
      min_order_amount INTEGER DEFAULT 0,
      max_discount_amount INTEGER,
      usage_limit INTEGER,
      times_used INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_public_code ON orders(public_code);
    CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
  `);

  // Non-destructive migrations for existing SQLite databases
  try {
    db.exec("ALTER TABLE orders ADD COLUMN coupon_code TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0;");
  } catch {}
  try {
    db.exec("ALTER TABLE orders ADD COLUMN is_gift INTEGER DEFAULT 0;");
  } catch {}
  try {
    db.exec("ALTER TABLE orders ADD COLUMN recipient_name TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE orders ADD COLUMN recipient_phone TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE orders ADD COLUMN gift_message TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE products ADD COLUMN daily_batch_limit INTEGER DEFAULT 15;");
  } catch {}
}

function seedInitialData(db: DatabaseSync) {
  const catCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (catCount > 0) return;

  const now = new Date().toISOString();

  // 1. Categories
  const insertCat = db.prepare(`
    INSERT INTO categories (slug, sort_order, active, name_en, name_bn, description_en, description_bn)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertCat.run('flans-puddings', 1, 1, 'Flans & Puddings', 'ফ্ল্যান ও পুডিং', 'Silky, velvety melt-in-mouth creamy desserts with golden caramel.', 'সোনালী ক্যারামেলের সাথে মুখে মিলিয়ে যাওয়া সিল্কি ক্রিমি ডেজার্ট।');
  insertCat.run('signature-cakes', 2, 1, 'Signature Cakes', 'স্পেশাল কেক', 'Rich, decadent homemade cakes baked fresh from scratch.', 'খাঁটি মাখনে ও চকলেট গানাশে তৈরি বিশেষ কেক।');
  insertCat.run('jar-desserts', 3, 1, 'Dessert Jars', 'জার ডেজার্ট', 'Portion-perfect layered dessert jars, easy to share & indulge.', 'স্তরযুক্ত সুস্বাদু ডেজার্ট জার, যেকোনো অনুষ্ঠানের জন্য উপযোগী।');
  insertCat.run('pastries-tarts', 4, 1, 'Pastries & Tarts', 'পেস্ট্রি ও কাপকেক', 'Artisanal individual pastries and gourmet frosted cupcakes.', 'নরম স্পঞ্জ কাপকেক ও ক্রিস্পি ফ্রুট টার্ট।');
  insertCat.run('traditional-fusion', 5, 1, 'Traditional & Fusion', 'ঐতিহ্যবাহী ও ফিউশন মিষ্টি', 'Bangladeshi heritage favorites refined with artisanal technique.', 'খাঁটি দুধে জ্বাল দেওয়া ঐতিহ্যবাহী শাহী ফিরনি ও ক্ষীর।');

  // 2. Products
  const insertProd = db.prepare(`
    INSERT INTO products (
      category_id, slug, status, sort_order, base_price,
      name_en, name_bn, description_en, description_bn,
      ingredients_en, ingredients_bn, allergens_en, allergens_bn,
      lead_time_en, lead_time_bn, image_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVar = db.prepare(`
    INSERT INTO product_variants (product_id, label_en, label_bn, sku, price_adjustment, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Product 1: Signature Caramel Custard Flan (Brand Hero)
  insertProd.run(
    1,
    'caramel-custard-flan',
    'published',
    1,
    450,
    'Caramel Custard Flan',
    'ক্যারামেল কাস্টার্ড ফ্ল্যান',
    'Our signature showstopper! Ultra-silky baked custard infused with pure vanilla, crowned with a rich amber caramel glaze that gently cascades down.',
    'আমাদের সিগনেচার স্পেশাল ডেজার্ট! খাঁটি ভ্যানিলা ও দুধে তৈরি তুলতুলে বেকড কাস্টার্ড, যার উপরে রয়েছে সোনালী তরল ক্যারামেল। মুখে দিলেই মিলিয়ে যাবে।',
    'Fresh cow milk, farm eggs, pure cane sugar, sweet cream, vanilla bean extract.',
    'তাজা গরুর দুধ, ফার্মের ডিম, চিনি, ডেইরি ক্রিম, প্রিমিয়াম ভ্যানিলা এক্সট্র্যাক্ট।',
    'Contains Milk and Eggs.',
    'দুধ এবং ডিম রয়েছে।',
    '4 hours lead time (Freshly baked)',
    '৪ ঘন্টা প্রস্তুতি সময় (তাজা বেকড)',
    'https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?w=800&auto=format&fit=crop&q=80',
    now,
    now
  );
  insertVar.run(1, 'Standard (approx. 500g)', 'স্ট্যান্ডার্ড (প্রায় ৫০০ গ্রাম)', 'FLAN-500', 0, 1, 1);
  insertVar.run(1, 'Family Size (approx. 1kg)', 'ফ্যামিলি সাইজ (প্রায় ১ কেজি)', 'FLAN-1000', 400, 1, 2);

  // Product 2: Royal Chocolate Fudge Cake
  insertProd.run(
    2,
    'royal-chocolate-fudge-cake',
    'published',
    2,
    750,
    'Royal Chocolate Fudge Cake',
    'রয়েল চকোলেট ফাজ কেক',
    'Dense, moist chocolate sponge blanketed with silky Belgian dark chocolate fudge ganache. The ultimate indulgence for true chocolate lovers.',
    'গাঢ় আর্দ্র চকোলেট স্পঞ্জের উপর খাঁটি বেলজিয়ান ডার্ক চকোলেট ফাজ গানাশ। চকলেটপ্রেমীদের জন্য পরম আনন্দের এক টুকরো স্বাদ।',
    'Flour, Dutch cocoa powder, Belgian dark chocolate, butter, cream, sugar, eggs.',
    'ময়দা, ডাচ কোকো পাউডার, বেলজিয়ান ডার্ক চকলেট, খাঁটি মাখন, তরল ক্রিম, চিনি, ডিম।',
    'Contains Milk, Eggs, Wheat/Gluten.',
    'দুধ, ডিম এবং গ্লুটেন রয়েছে।',
    'Same Day (3 hours lead time)',
    'একই দিনে ডেলিভারি (৩ ঘন্টা প্রস্তুতি সময়)',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80',
    now,
    now
  );
  insertVar.run(2, 'Medium (500g Bento)', 'মিডিয়াম (৫০০ গ্রাম বেন্টো)', 'CAKE-FUDGE-500', 0, 1, 1);
  insertVar.run(2, 'Full 1 Pound (450-500g)', 'ফুল ১ পাউন্ড', 'CAKE-FUDGE-1LB', 100, 1, 2);
  insertVar.run(2, 'Large 2 Pound (approx. 1kg)', 'বড় ২ পাউন্ড (১ কেজি)', 'CAKE-FUDGE-2LB', 650, 1, 3);

  // Product 3: Lotus Biscoff Layered Jar Cake
  insertProd.run(
    3,
    'lotus-biscoff-jar-cake',
    'published',
    3,
    280,
    'Lotus Biscoff Jar Cake',
    'লোটাস বিসকফ জার কেক',
    'Decadent layers of spiced Lotus Biscoff biscuit crumble, velvety cream cheese mousse, and melted Biscoff spread in a neat takeaway jar.',
    'লোটাস বিসকফ বিস্কুটের ক্রাঞ্চ, মোলায়েম ক্রিম চিজ মুজ এবং গলানো বিসকফ স্প্রেডের লোভনীয় লেয়ার। কাঁচের সুন্দর জারে পরিবেশিত।',
    'Lotus Biscoff spread, Biscoff cookies, cream cheese, dairy whipping cream, vanilla.',
    'লোটাস বিসকফ স্প্রেড, বিসকফ কুকিজ, ক্রিম চিজ, হুইপিং ক্রিম, ভ্যানিলা।',
    'Contains Milk, Wheat/Gluten, Soy.',
    'দুধ, গ্লুটেন এবং সয়াবিন রয়েছে।',
    'Ready for immediate dispatch / 1 hour',
    'তাত্ক্ষণিক বা ১ ঘন্টার মধ্যে ডেলিভারি প্রস্তুত',
    'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&auto=format&fit=crop&q=80',
    now,
    now
  );
  insertVar.run(3, 'Single Jar (250ml)', '১টি জার (২৫০ মিলি)', 'JAR-BISC-1', 0, 1, 1);
  insertVar.run(3, 'Twin Pack (2 Jars - Save ৳30)', 'টুইন প্যাক (২টি জার - ৳৩০ ছাড়)', 'JAR-BISC-2', 250, 1, 2);
  insertVar.run(3, 'Party Box (4 Jars - Save ৳100)', 'পার্টি বক্স (৪টি জার - ৳১০০ ছাড়)', 'JAR-BISC-4', 740, 1, 3);

  // Product 4: Classic Italian Tiramisu Cup
  insertProd.run(
    3,
    'classic-tiramisu-cup',
    'published',
    4,
    300,
    'Classic Italian Tiramisu Cup',
    'ক্লাসিক ইতালিয়ান তিরামিসু কাপ',
    'Delicate ladyfinger biscuits dipped in freshly brewed aromatic espresso, layered with whipped mascarpone cream and dusted with fine cocoa.',
    'তাজা এসপ্রেসো কফিতে ডোবানো স্পঞ্জ লেডিফিঙ্গার্স, সিল্কি মাসকারপন ক্রিম এবং উপরে কোকো ডাস্টের মেলবন্ধন।',
    'Mascarpone cheese, heavy cream, ladyfingers, espresso coffee, cocoa powder, sugar.',
    'মাসকারপন চিজ, হেভি ক্রিম, লেডিফিঙ্গার্স বিস্কুট, এসপ্রেসো কফি, কোকো পাউডার।',
    'Contains Milk, Eggs, Wheat.',
    'দুধ, ডিম এবং গম/গ্লুটেন রয়েছে।',
    'Same Day (2 hours lead time)',
    'একই দিনে ডেলিভারি (২ ঘন্টা সময় প্রয়োজন)',
    'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80',
    now,
    now
  );

  // Product 5: Rajshahi Special Mango Delight
  insertProd.run(
    5,
    'rajshahi-mango-delight',
    'published',
    5,
    320,
    'Rajshahi Mango Cream Delight',
    'রাজশাহী স্পেশাল ম্যাঙ্গো ডিলাইট',
    'Inspired by our beloved Rajshahi mangoes! A light, moist vanilla sponge soaked with sweet mango pulp, rich condensed milk cream, and mango chunks.',
    'আমাদের প্রিয় রাজশাহীর আমের স্বাদে তৈরি! নরম ভ্যানিলা স্পঞ্জ কেক, ঘন আমের পিউরি ও সুস্বাদু ক্রিমে ভেজানো মিষ্টি এক অনন্য অনুভূতি।',
    'Rajshahi mango puree, condensed milk, whipping cream, sponge cake, cardamom aroma.',
    'রাজশাহীর সুস্বাদু আমের পিউরি, কনডেন্সড মিল্ক, হুইপিং ক্রিম, ভ্যানিলা স্পঞ্জ, এলাচের সুবাস।',
    'Contains Milk, Wheat.',
    'দুধ এবং গম/গ্লুটেন রয়েছে।',
    '4 hours lead time (Made fresh to order)',
    '৪ ঘন্টা প্রস্তুতি সময় (অর্ডারের পর তাজা তৈরি)',
    'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80',
    now,
    now
  );

  // Product 6: Shahi Pistachio & Saffron Firni
  insertProd.run(
    5,
    'shahi-pistachio-saffron-firni',
    'published',
    6,
    220,
    'Shahi Pistachio & Saffron Firni',
    'শাহী পেস্তা জাফরান ফিরনি',
    'Slow-simmered rich creamy milk pudding made with ground fragrant Chinigura rice, infused with Iranian saffron, green cardamom, and toasted pistachios.',
    'সুগন্ধি চিনিগুড়া চাল ও ঘন দুধে ধিমে আঁচে রান্না করা ঐতিহ্যবাহী শাহী ফিরনি। আসল ইরানি জাফরান, এলাচ আর পেস্তা বাদামের কুচিতে সমৃদ্ধ।',
    'Full cream cow milk, Chinigura rice, Iranian saffron, pistachio nuts, almonds, sugar.',
    'ফুল ক্রিম গরুর দুধ, চিনিগুড়া চাল, ইরানি জাফরান, পেস্তা বাদাম, কাঠবাদাম, এলাচ, চিনি।',
    'Contains Milk, Tree Nuts (Pistachio, Almond).',
    'দুধ এবং বাদাম রয়েছে।',
    'Same Day / 2 hours lead time',
    'একই দিনে ডেলিভারি (২ ঘন্টা সময় প্রয়োজন)',
    'https://images.unsplash.com/photo-1517244683847-7456b63c5969?w=600&auto=format&fit=crop&q=80',
    now,
    now
  );
  insertVar.run(6, 'Clay Matir Cup (Single 200g)', 'মাটির পাত্রে ১ কাপ (২০০ গ্রাম)', 'FIRNI-1', 0, 1, 1);
  insertVar.run(6, 'Clay Matir Bowl (Family 500g)', 'মাটির বড় পাত্রে (৫০০ গ্রাম)', 'FIRNI-FAM', 280, 1, 2);

  // Product 7: Velvet Strawberry Cupcakes (Box of 4)
  insertProd.run(
    4,
    'red-velvet-strawberry-cupcakes',
    'published',
    7,
    380,
    'Velvet Strawberry Cupcakes (Box of 4)',
    'রেড ভেলভেট স্ট্রবেরি কাপকেক (৪টির বক্স)',
    'Four tender red velvet cupcakes topped with luxurious cream cheese frosting and fresh strawberry drizzle. Elegantly boxed with a ribbon.',
    'হালকা কোকো ফ্লেভারের ৪টি নরম রেড ভেলভেট কাপকেক, উপরে সিল্কি ক্রিম চিজ ফ্রস্টিং ও তাজা স্ট্রবেরি। সুন্দর গিফট বক্সে ফিতা দিয়ে বাঁধা।',
    'Flour, cocoa, buttermilk, butter, cream cheese, sugar, eggs, natural berry glaze.',
    'ময়দা, কোকো, বাটারমিল্ক, মাখন, ক্রিম চিজ, চিনি, ডিম, স্ট্রবেরি গ্লেজ।',
    'Contains Milk, Eggs, Wheat.',
    'দুধ, ডিম এবং গম রয়েছে।',
    'Made fresh to order (4 hours lead time)',
    '৪ ঘন্টা প্রস্তুতি সময় (অর্ডারের পর তাজা তৈরি)',
    'https://images.unsplash.com/photo-1587668178277-295251f900ce?w=600&auto=format&fit=crop&q=80',
    now,
    now
  );

  // 3. Initial Settings
  const insertSetting = db.prepare(`
    INSERT INTO shop_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
  `);

  insertSetting.run('service_city', 'Rajshahi', now, 'system');
  insertSetting.run('coverage_statement_en', 'Fresh homemade delivery available across Rajshahi City', now, 'system');
  insertSetting.run('coverage_statement_bn', 'রাজশাহী শহরজুড়ে ঘরে তৈরি তাজা ডেজার্ট হোম ডেলিভারি', now, 'system');
  insertSetting.run('delivery_fee', '50', now, 'system');
  insertSetting.run('free_delivery_threshold', '1200', now, 'system');
  insertSetting.run('is_store_paused', 'false', now, 'system');
  insertSetting.run('pause_message_en', 'Our kitchen is currently fulfilling active orders. New orders will resume shortly!', now, 'system');
  insertSetting.run('pause_message_bn', 'কিচেনে চাপ বেশি থাকায় সাময়িকভাবে নতুন অর্ডার গ্রহণ বন্ধ রয়েছে। শীঘ্রই অর্ডার নেওয়া শুরু হবে!', now, 'system');
  insertSetting.run('whatsapp_number', '', now, 'system');
  insertSetting.run('cod_enabled', 'true', now, 'system');
  insertSetting.run('bkash_enabled', 'true', now, 'system');
  // Wallet numbers are intentionally left blank here: they must be set by
  // the shop owner in the admin settings. Never seed a real-looking number.
  insertSetting.run('bkash_number', '', now, 'system');
  insertSetting.run('bkash_type', 'personal', now, 'system');
  insertSetting.run('bkash_instructions_en', '1. Open your bKash app and select Send Money.\n2. Send the exact order total to the bKash number shown on your order page.\n3. Complete the payment and copy the Transaction ID (TrxID).\n4. Paste the TrxID on your order page so we can verify it quickly.', now, 'system');
  insertSetting.run('bkash_instructions_bn', '১. বিকাশ অ্যাপে গিয়ে Send Money নির্বাচন করুন।\n২. অর্ডার পেজে দেখানো বিকাশ নম্বরে সর্বমোট অর্ডারের টাকার পরিমাণ পাঠান।\n৩. পেমেন্ট সম্পন্ন করে TrxID কপি করুন।\n৪. দ্রুত ভেরিফিকেশনের জন্য TrxID অর্ডার পেজে পেস্ট করুন।', now, 'system');
  insertSetting.run('nagad_enabled', 'true', now, 'system');
  insertSetting.run('nagad_number', '', now, 'system');
  insertSetting.run('nagad_type', 'personal', now, 'system');
  insertSetting.run('nagad_instructions_en', '1. Open your Nagad app and select Send Money.\n2. Send the exact order amount to the Nagad number shown on your order page.\n3. Note down the Transaction ID (TrxID) and enter it on your order page.', now, 'system');
  insertSetting.run('nagad_instructions_bn', '১. নগদ অ্যাপে গিয়ে Send Money নির্বাচন করুন।\n২. অর্ডার পেজে দেখানো নগদ নম্বরে সঠিক পরিমাণ টাকা পাঠান।\n৩. পেমেন্ট শেষে প্রাপ্ত TrxID অর্ডার পেজে লিখে সাবমিট করুন।', now, 'system');

}

function seedDefaultCoupons(db: DatabaseSync) {
  try {
    const couponCount = (db.prepare('SELECT COUNT(*) as count FROM coupons').get() as { count: number }).count;
    if (couponCount === 0) {
      const now = new Date().toISOString();
      const insertCoupon = db.prepare(`
        INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, times_used, active, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 1, NULL, ?)
      `);
      insertCoupon.run('WELCOME50', 'fixed', 50, 400, null, 100, now);
      insertCoupon.run('SWEETRAJ', 'percentage', 10, 600, 150, 50, now);
      insertCoupon.run('EIDMUBARAK', 'percentage', 15, 1000, 250, 50, now);
      insertCoupon.run('SWEETREWARD', 'fixed', 150, 200, null, 5000, now);
    } else {
      const hasReward = db.prepare('SELECT id FROM coupons WHERE code = ?').get('SWEETREWARD');
      if (!hasReward) {
        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, times_used, active, expires_at, created_at)
          VALUES ('SWEETREWARD', 'fixed', 150, 200, NULL, 5000, 0, 1, NULL, ?)
        `).run(now);
      }
    }
  } catch {}
}

export function getShopSettings(): ShopSettings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM shop_settings').all() as { key: string; value: string }[];
  
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  return {
    service_city: map.service_city || 'Rajshahi',
    coverage_statement_en: map.coverage_statement_en || 'Delivery available across Rajshahi City',
    coverage_statement_bn: map.coverage_statement_bn || 'রাজশাহী শহরজুড়ে হোম ডেলিভারি সুবিধা',
    delivery_fee: parseInt(map.delivery_fee || '50', 10),
    free_delivery_threshold: parseInt(map.free_delivery_threshold || '1200', 10),
    is_store_paused: map.is_store_paused === 'true',
    pause_message_en: map.pause_message_en || '',
    pause_message_bn: map.pause_message_bn || '',
    whatsapp_number: map.whatsapp_number || '',
    cod_enabled: map.cod_enabled !== 'false',
    bkash_enabled: map.bkash_enabled !== 'false',
    bkash_number: map.bkash_number || '',
    bkash_type: (map.bkash_type as 'personal' | 'merchant') || 'personal',
    bkash_instructions_en: map.bkash_instructions_en || '',
    bkash_instructions_bn: map.bkash_instructions_bn || '',
    nagad_enabled: map.nagad_enabled !== 'false',
    nagad_number: map.nagad_number || '',
    nagad_type: (map.nagad_type as 'personal' | 'merchant') || 'personal',
    nagad_instructions_en: map.nagad_instructions_en || '',
    nagad_instructions_bn: map.nagad_instructions_bn || '',
    telegram_bot_token: map.telegram_bot_token || '',
    telegram_chat_id: map.telegram_chat_id || '',
    sms_gateway_url: map.sms_gateway_url || '',
    sms_api_key: map.sms_api_key || '',
    sms_sender_id: map.sms_sender_id || '',
    notifications_enabled: map.notifications_enabled === 'true',
  };
}

export function updateShopSetting(key: string, value: string, actor: string = 'admin') {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO shop_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `).run(key, value, now, actor);

  db.prepare(`
    INSERT INTO audit_log (actor, action, entity, details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(actor, 'UPDATE_SETTING', key, `Value set to: ${value.slice(0, 80)}`, now);
}

export function getCategories(includeInactive: boolean = false): Category[] {
  const db = getDb();
  const query = includeInactive 
    ? 'SELECT * FROM categories ORDER BY sort_order ASC'
    : 'SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC';
  return db.prepare(query).all() as unknown as Category[];
}

export function getProducts(options: { categoryId?: number; status?: string; includeArchived?: boolean } = {}): Product[] {
  const db = getDb();
  let sql = `
    SELECT p.*, c.name_en as category_name_en, c.name_bn as category_name_bn
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (!options.includeArchived) {
    sql += ` AND p.status != 'archived'`;
  }

  if (options.status) {
    sql += ` AND p.status = ?`;
    params.push(options.status);
  }

  if (options.categoryId) {
    sql += ` AND p.category_id = ?`;
    params.push(options.categoryId);
  }

  sql += ` ORDER BY p.sort_order ASC, p.id DESC`;

  const products = db.prepare(sql).all(...params) as unknown as Product[];
  
  // Attach variants and daily batch counts
  const varStmt = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort_order ASC');
  const soldStmt = db.prepare(`
    SELECT COALESCE(SUM(oi.quantity), 0) as sold_today
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = ?
      AND date(o.created_at) = date('now')
      AND o.order_status != 'cancelled'
  `);

  for (const p of products) {
    p.variants = varStmt.all(p.id) as unknown as ProductVariant[];
    try {
      const soldRow = soldStmt.get(p.id) as { sold_today: number } | undefined;
      const sold = Number(soldRow?.sold_today || 0);
      p.sold_today = sold;
      p.daily_batch_limit = Number(p.daily_batch_limit ?? 15);
      p.remaining_today = Math.max(0, p.daily_batch_limit - sold);
    } catch {
      p.sold_today = 0;
      p.daily_batch_limit = 15;
      p.remaining_today = 15;
    }
  }

  return products;
}

export function getProductBySlug(slug: string): Product | null {
  const db = getDb();
  const sql = `
    SELECT p.*, c.name_en as category_name_en, c.name_bn as category_name_bn
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ?
  `;
  const product = db.prepare(sql).get(slug) as unknown as Product | null;
  if (!product) return null;

  product.variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort_order ASC').all(product.id) as unknown as ProductVariant[];
  try {
    const soldRow = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity), 0) as sold_today
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = ?
        AND date(o.created_at) = date('now')
        AND o.order_status != 'cancelled'
    `).get(product.id) as { sold_today: number } | undefined;
    const sold = Number(soldRow?.sold_today || 0);
    product.sold_today = sold;
    product.daily_batch_limit = Number(product.daily_batch_limit ?? 15);
    product.remaining_today = Math.max(0, product.daily_batch_limit - sold);
  } catch {
    product.sold_today = 0;
    product.daily_batch_limit = 15;
    product.remaining_today = 15;
  }
  return product;
}

export function generatePublicOrderCode(): string {
  // Generate human-friendly non-sequential code: e.g. SC-78241
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `SC-${randomNum}`;
}

/**
 * Generate a public order code that does not already exist in the database.
 * Bounded retries; throws if no free code is found (callers should surface
 * a 500 rather than create a duplicate order). The UNIQUE constraint on
 * orders.public_code remains as a backstop.
 */
export function generateUniquePublicOrderCode(db: DatabaseSync, maxAttempts = 10): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generatePublicOrderCode();
    const existing = db.prepare('SELECT 1 FROM orders WHERE public_code = ?').get(code);
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique order code');
}

/** Normalize a Bangladesh phone number for comparison: digits only, strip +88. */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('88') && digits.length === 13) {
    digits = digits.slice(2);
  }
  return digits;
}

export function getOrderWithDetails(publicCode: string, phoneFilter?: string): Order | null {
  // Phone verification is mandatory: without a matching phone number the
  // order is not returned, and callers cannot tell whether the code exists.
  const normalizedFilter = phoneFilter ? normalizePhone(phoneFilter) : '';
  if (!normalizedFilter) return null;

  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE public_code = ?').get(publicCode) as unknown as Order | null;
  if (!order) return null;
  if (normalizePhone(order.customer_phone) !== normalizedFilter) return null;

  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as unknown as OrderItem[];
  order.events = db.prepare('SELECT * FROM order_status_events WHERE order_id = ? ORDER BY created_at ASC').all(order.id) as unknown as OrderStatusEvent[];
  order.payment_submissions = db.prepare('SELECT * FROM payment_submissions WHERE order_id = ? ORDER BY submitted_at DESC').all(order.id) as unknown as PaymentSubmission[];

  return order;
}

export function getAllOrders(filterStatus?: string): Order[] {
  const db = getDb();
  let sql = `
    SELECT o.*,
      (SELECT COUNT(*) FROM orders o2 WHERE replace(replace(o2.customer_phone, ' ', ''), '-', '') = replace(replace(o.customer_phone, ' ', ''), '-', '') AND o2.order_status = 'completed') as completed_orders_count
    FROM orders o
  `;
  const params: unknown[] = [];

  if (filterStatus && filterStatus !== 'all') {
    sql += ' WHERE o.order_status = ?';
    params.push(filterStatus);
  }

  sql += ' ORDER BY o.id DESC';

  const orders = db.prepare(sql).all(...params) as unknown as Order[];
  if (!orders || orders.length === 0) {
    return [];
  }

  // Batch query to eliminate N+1 database roundtrips
  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(',');

  const allItems = db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
    .all(...orderIds) as unknown as OrderItem[];

  const allEvents = db
    .prepare(`SELECT * FROM order_status_events WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...orderIds) as unknown as OrderStatusEvent[];

  const allPayments = db
    .prepare(`SELECT * FROM payment_submissions WHERE order_id IN (${placeholders}) ORDER BY submitted_at DESC`)
    .all(...orderIds) as unknown as PaymentSubmission[];

  const itemsByOrder = new Map<number, OrderItem[]>();
  allItems.forEach((item) => {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  });

  const eventsByOrder = new Map<number, OrderStatusEvent[]>();
  allEvents.forEach((ev) => {
    const list = eventsByOrder.get(ev.order_id) || [];
    list.push(ev);
    eventsByOrder.set(ev.order_id, list);
  });

  const paymentsByOrder = new Map<number, PaymentSubmission[]>();
  allPayments.forEach((pay) => {
    const list = paymentsByOrder.get(pay.order_id) || [];
    list.push(pay);
    paymentsByOrder.set(pay.order_id, list);
  });

  for (const ord of orders) {
    ord.items = itemsByOrder.get(ord.id) || [];
    ord.events = eventsByOrder.get(ord.id) || [];
    ord.payment_submissions = paymentsByOrder.get(ord.id) || [];
  }

  return orders;
}

export function getCouponByCode(code: string): Coupon | null {
  const db = getDb();
  const cleanCode = code.trim().toUpperCase();
  const coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ?').get(cleanCode) as unknown as Coupon | null;
  return coupon;
}

export function incrementCouponUsage(code: string): void {
  const db = getDb();
  const cleanCode = code.trim().toUpperCase();
  db.prepare('UPDATE coupons SET times_used = times_used + 1 WHERE UPPER(code) = ?').run(cleanCode);
}

export function getAllCoupons(): Coupon[] {
  const db = getDb();
  return db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() as unknown as Coupon[];
}

export function createCoupon(data: {
  code: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  expiresAt?: string | null;
}): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, times_used, active, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
  `).run(
    data.code.trim().toUpperCase(),
    data.discountType,
    data.discountValue,
    data.minOrderAmount || 0,
    data.maxDiscountAmount || null,
    data.usageLimit || null,
    data.expiresAt || null,
    now
  );
  return Number(result.lastInsertRowid);
}

export function toggleCouponStatus(id: number, active: number): void {
  const db = getDb();
  db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

export function deleteCoupon(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
}

export function getCustomerLoyalty(phone: string): LoyaltyInfo {
  const db = getDb();
  // Strip non-digits and take last 10-11 digits (e.g. 01712345678 or 1712345678)
  const cleanDigits = phone.replace(/\D/g, '');
  const searchPattern = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

  const row = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END) as total_spent,
      (SELECT customer_name FROM orders WHERE replace(replace(customer_phone, ' ', ''), '-', '') LIKE '%' || ? ORDER BY id DESC LIMIT 1) as customer_name
    FROM orders 
    WHERE replace(replace(customer_phone, ' ', ''), '-', '') LIKE '%' || ?
  `).get(searchPattern, searchPattern) as {
    total_orders: number;
    completed_orders: number;
    total_spent: number;
    customer_name: string | null;
  } | undefined;

  const completed = Number(row?.completed_orders || 0);
  const stamps = completed % 5;
  const stampsToNext = stamps === 0 && completed > 0 ? 0 : 5 - stamps;
  const rewardsEarned = Math.floor(completed / 5);

  let tier = 'Sweet Explorer';
  let tierBn = 'মিষ্টিপ্রেমী শুরু';
  if (completed >= 10) {
    tier = 'Sweet Royal Connoisseur';
    tierBn = 'রয়্যাল সুইট ক্লাব';
  } else if (completed >= 5) {
    tier = 'Patisserie VIP';
    tierBn = 'প্যাটিসেরি ভিআইপি';
  } else if (completed >= 2) {
    tier = 'Flan Fanatic';
    tierBn = 'ফ্ল্যান ফ্যানাটিক';
  }

  return {
    phone: cleanDigits,
    customerName: row?.customer_name || null,
    totalOrders: Number(row?.total_orders || 0),
    completedOrders: completed,
    totalSpent: Number(row?.total_spent || 0),
    stamps,
    stampsNeeded: 5,
    stampsToNextReward: stampsToNext,
    rewardsEarned,
    tier,
    tierBn,
    rewardCouponCode: 'SWEETREWARD'
  };
}
