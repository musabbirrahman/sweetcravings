import type { Client as LibsqlClient } from '@libsql/client';
import { getTursoClient } from './turso';
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

// ---------------------------------------------------------------------------
// Driver-neutral database handle.
//
// The app talks to SQLite through this small surface only: exec() and
// prepare() with get()/all()/run(). Two drivers implement it, and the
// rest of the app never sees which one is active:
//
// - Local (default): Node's built-in `node:sqlite`, one file at
//   data/sweetcravings.db. Works offline with zero config. It is loaded
//   lazily (dynamic import, inside the local branch only) so the module
//   can also load on Cloudflare Workers, where node:sqlite does not
//   exist — on Workers TURSO_DATABASE_URL is always set instead.
// - Turso (when TURSO_DATABASE_URL is set): the async `@libsql/client`,
//   against a remote libsql:// database (or a `file:` URL, used by the
//   tests). @libsql/client runs on Cloudflare Workers (its `workerd`
//   export is a pure fetch client); the native `libsql` package used by
//   the first Turso pass cannot run on Workers, so it is gone.
//
// The query surface is async throughout (prepare() returns a statement
// whose get()/all()/run() return promises), so every route handler and
// helper awaits its queries. That is the price of a driver that works
// on Workers; the call sites are otherwise unchanged.
// ---------------------------------------------------------------------------

/** One prepared statement: the only query surface the app uses. */
export interface DbStatement {
  get(...params: unknown[]): Promise<unknown>;
  all(...params: unknown[]): Promise<unknown[]>;
  run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
}

/** One statement inside a batch: SQL text plus its bound arguments. */
export interface BatchStatement {
  sql: string;
  args?: unknown[];
}

/** The per-statement result of a batch: rows changed and the new row id. */
export interface BatchResult {
  rowsAffected: number;
  lastInsertRowid: number | bigint;
}

/** The database handle every query in the app runs through. */
export interface DbHandle {
  exec(sql: string): Promise<void>;
  prepare(sql: string): DbStatement;
  /**
   * Run several write statements as ONE atomic batch in a SINGLE round
   * trip (remote driver) / one local transaction (local driver).
   *
   * This exists because an interactive transaction
   * (client.transaction('write')) holds one Hrana stream open across
   * every statement, and Turso rolls it back when the stream sits idle
   * for too long (5-second window). A checkout/conversion transaction
   * ran ~7-12 statements, each its own HTTPS round trip from a
   * Cloudflare Worker, so slow checkouts failed with "SQLITE_BUSY:
   * ... rolled back because the stream was idle for too long" and no
   * order was created. client.batch(..., 'write') pipelines BEGIN +
   * every statement + COMMIT into one HTTP request, so there is no idle
   * stream to roll back. Customer-facing writes (checkout, draft
   * conversion, TrxID re-submit) must use this; runInTransaction stays
   * for admin-only paths (product edits, backup restore).
   *
   * On failure the whole batch is rolled back and the error carries
   * the failing statement's 0-based index (see batchErrorIndex) — a
   * UNIQUE-constraint failure on the payment-submission statement
   * means a duplicate TrxID.
   */
  batch(statements: BatchStatement[]): Promise<BatchResult[]>;
  /**
   * Run fn() inside one transaction (commit on success, rollback on
   * throw). Both drivers run this the same way; callers must use this
   * instead of BEGIN/COMMIT by hand, because a bare `BEGIN` sent as a
   * lone statement to a remote database does not hold a transaction
   * across the separate requests that follow it.
   */
  transaction<T>(fn: (tx: DbHandle) => Promise<T> | T): Promise<T>;
}

/** Convert a query's arguments to the values @libsql/client accepts. */
function toLibsqlArgs(params: unknown[]): Array<string | number | bigint | boolean | null | Uint8Array> {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'string' || typeof p === 'number' || typeof p === 'bigint' || typeof p === 'boolean' || p === null) return p;
    if (p instanceof Uint8Array) return p;
    return String(p);
  });
}

/**
 * An object that can run one statement (or a script) — a @libsql/client
 * Client and a Transaction both qualify.
 */
type LibsqlExecutor = Pick<LibsqlClient, 'execute' | 'executeMultiple'>;

/**
 * Wrap a @libsql/client Client (or a Transaction) as a DbHandle.
 * `batchFn` is supplied only at the client level: a batch runs on the
 * client (one pipelined request), never inside an interactive
 * transaction, where it would defeat the purpose.
 */
function wrapRemote(ex: LibsqlExecutor, batchFn?: (statements: BatchStatement[]) => Promise<BatchResult[]>): DbHandle {
  return {
    exec: async (sql: string): Promise<void> => {
      await ex.executeMultiple(sql);
    },
    prepare: (sql: string): DbStatement => ({
      get: async (...params: unknown[]) => {
        const rs = await ex.execute({ sql, args: toLibsqlArgs(params) });
        return rs.rows[0] as unknown;
      },
      all: async (...params: unknown[]) => {
        const rs = await ex.execute({ sql, args: toLibsqlArgs(params) });
        return rs.rows as unknown as unknown[];
      },
      run: async (...params: unknown[]) => {
        const rs = await ex.execute({ sql, args: toLibsqlArgs(params) });
        return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid ?? 0 };
      },
    }),
    batch: async (statements: BatchStatement[]): Promise<BatchResult[]> => {
      if (!batchFn) throw new Error('batch() is not available inside a transaction');
      return batchFn(statements);
    },
    transaction: async <T>(): Promise<T> => {
      // A bare executor has no transaction of its own; the client-level
      // wrapper below replaces this method with a real one.
      throw new Error('transaction() is not available on this handle');
    },
  };
}

/** Wrap a @libsql/client Client as a DbHandle with real transactions. */
function wrapRemoteClient(client: LibsqlClient): DbHandle {
  const base = wrapRemote(client, async (statements: BatchStatement[]): Promise<BatchResult[]> => {
    // One HTTP request: BEGIN IMMEDIATE + every statement + COMMIT,
    // pipelined by the client. A failure rolls the whole batch back
    // and throws a LibsqlBatchError carrying the failing statement's
    // 0-based index (statementIndex).
    const results = await client.batch(
      statements.map((s) => ({ sql: s.sql, args: toLibsqlArgs(s.args ?? []) })),
      'write'
    );
    return results.map((r) => ({ rowsAffected: r.rowsAffected, lastInsertRowid: r.lastInsertRowid ?? 0 }));
  });
  return {
    ...base,
    transaction: async <T>(fn: (tx: DbHandle) => Promise<T> | T): Promise<T> => {
      const tx = await client.transaction('write');
      const txHandle = wrapRemote(tx);
      try {
        const result = await fn(txHandle);
        await tx.commit();
        return result;
      } catch (err) {
        try { await tx.rollback(); } catch {}
        throw err;
      }
    },
  };
}

/**
 * Build the local handle: Node's built-in `node:sqlite`, one file at
 * data/sweetcravings.db. node:sqlite (and node:fs/path) are imported
 * dynamically here — and only here — so this module still loads on
 * Cloudflare Workers, where those modules do not exist.
 */
async function makeLocalHandle(): Promise<DbHandle> {
  const { DatabaseSync } = await import('node:sqlite');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new DatabaseSync(path.join(DATA_DIR, 'sweetcravings.db'));
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  // The local driver is ONE shared connection: two route handlers calling
  // transaction() at once would collide on it ("cannot start a
  // transaction within a transaction"). Serialize whole multi-statement
  // writes (transactions and batches) through this queue, so a
  // check-then-write inside one transaction (batch limit, duplicate
  // TrxID) really cannot race with another. No runInTransaction call
  // nests inside another, so this cannot deadlock. The remote (Turso)
  // driver does not need it: each client.transaction('write') is a
  // separate server-side transaction.
  let txQueue: Promise<void> = Promise.resolve();
  async function runSerialized<T>(fn: () => T | Promise<T>): Promise<T> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const prev = txQueue;
    // Adopt the gate even if the previous write failed, so a failure
    // never wedges the queue.
    txQueue = prev.then(() => gate, () => gate);
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      release();
    }
  }
  const handle: DbHandle = {
    exec: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    prepare: (sql: string): DbStatement => {
      const stmt = db.prepare(sql);
      return {
        get: async (...params: unknown[]) => stmt.get(...(params as never[])),
        all: async (...params: unknown[]) => stmt.all(...(params as never[])),
        run: async (...params: unknown[]) => stmt.run(...(params as never[])),
      };
    },
    batch: async (statements: BatchStatement[]): Promise<BatchResult[]> => {
      return runSerialized(() => {
        // One local transaction: every statement lands or none does.
        // Errors carry the failing statement's 0-based index
        // (statementIndex), matching the remote driver's
        // LibsqlBatchError, so callers map failures the same way.
        db.exec('BEGIN IMMEDIATE TRANSACTION;');
        try {
          const out: BatchResult[] = [];
          for (let i = 0; i < statements.length; i++) {
            const st = statements[i];
            try {
              const stmt = db.prepare(st.sql);
              const info = stmt.run(...(toLocalArgs(st.args ?? []) as never[]));
              out.push({ rowsAffected: info.changes, lastInsertRowid: info.lastInsertRowid });
            } catch (e) {
              const err = e instanceof Error ? e : new Error(String(e));
              (err as Error & { statementIndex?: number }).statementIndex = i;
              throw err;
            }
          }
          db.exec('COMMIT;');
          return out;
        } catch (e) {
          try { db.exec('ROLLBACK;'); } catch {}
          throw e;
        }
      });
    },
    transaction: async <T>(fn: (tx: DbHandle) => Promise<T> | T): Promise<T> => {
      return runSerialized(async () => {
        // IMMEDIATE: take the write lock up front, so the check inside
        // the transaction reads a stable snapshot.
        db.exec('BEGIN IMMEDIATE TRANSACTION;');
        try {
          const result = await fn(handle);
          db.exec('COMMIT;');
          return result;
        } catch (err) {
          try { db.exec('ROLLBACK;'); } catch {}
          throw err;
        }
      });
    },
  };
  return handle;
}

/**
 * Convert batch arguments to the values node:sqlite accepts.
 * (undefined is not a valid SQLite value there — it becomes NULL.)
 */
function toLocalArgs(params: unknown[]): Array<string | number | bigint | boolean | null | Uint8Array> {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'string' || typeof p === 'number' || typeof p === 'bigint' || typeof p === 'boolean' || p === null) return p;
    if (p instanceof Uint8Array) return p;
    return String(p);
  });
}

// Turso is on when a database URL is set. The auth token is optional:
// a remote database needs one, a local `file:` URL does not.
export function isTursoEnabled(): boolean {
  return (process.env.TURSO_DATABASE_URL || '').trim().length > 0;
}

let _db: DbHandle | null = null;
let _dbInit: Promise<DbHandle> | null = null;

/**
 * Get the database handle, creating it (and the schema + seed data) on
 * first use. The first call's promise is shared, so concurrent requests
 * at cold start all wait on one initialisation instead of racing to
 * create the schema twice.
 */
export async function getDb(): Promise<DbHandle> {
  if (_db) return _db;
  if (!_dbInit) {
    _dbInit = (async () => {
      const client = await getTursoClient();
      let handle: DbHandle;
      if (client) {
        handle = wrapRemoteClient(client);
        // Remote databases have no local journal file: WAL and
        // busy-timeout make no sense over the wire. Foreign keys are
        // attempted and ignored if the server refuses the pragma.
        try { await handle.exec('PRAGMA foreign_keys = ON;'); } catch {}
      } else {
        handle = await makeLocalHandle();
      }
      await initSchema(handle);
      await seedInitialData(handle);
      await seedDefaultCoupons(handle);
      _db = handle;
      return handle;
    })();
  }
  return _dbInit;
}

/**
 * Run fn() inside one database transaction. This is the only supported
 * way to group writes: use it for checkout, product edits and backup
 * restore. It commits on success and rolls back on throw, on either
 * driver.
 */
export async function runInTransaction<T>(db: DbHandle, fn: (tx: DbHandle) => Promise<T> | T): Promise<T> {
  return db.transaction(fn);
}

/**
 * True when a batch/transaction failure is worth one retry: Turso rolls
 * an interactive transaction back with SQLITE_BUSY when its stream sits
 * idle for too long, and the error text itself says to retry. A batch
 * that failed this way committed nothing, so retrying it is safe.
 */
export function isRetryableTxError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const e = err as { code?: unknown; errcode?: unknown; rawCode?: unknown } | null;
  return (
    e?.code === 'SQLITE_BUSY' ||
    // node:sqlite reports a busy database as "database is locked" with
    // errcode 5 (SQLITE_BUSY); @libsql/client reports the same condition
    // as rawCode 5 on its LibsqlError. Match the code, not just the text,
    // so the retry works on both drivers.
    e?.errcode === 5 ||
    e?.rawCode === 5 ||
    /SQLITE_BUSY/i.test(message) ||
    /database is locked/i.test(message) ||
    /idle for too long/i.test(message) ||
    /TRANSACTION_CLOSED/i.test(message)
  );
}

/**
 * The 0-based index of the statement that failed inside a batch, when
 * the driver reports one (remote: LibsqlBatchError.statementIndex;
 * local: the same property, attached by the local batch runner).
 */
export function batchErrorIndex(err: unknown): number | null {
  const idx = (err as { statementIndex?: unknown; index?: unknown } | null)?.statementIndex
    ?? (err as { index?: unknown } | null)?.index;
  return typeof idx === 'number' ? idx : null;
}

async function initSchema(db: DbHandle) {
  await db.exec(`
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
      order_status TEXT NOT NULL DEFAULT 'new', -- new, accepted, preparing, ready, out_for_delivery, completed, cancelled, draft
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

    -- Product photos uploaded through the admin panel. On Cloudflare
    -- Workers there is no disk, so resized photo bytes live here
    -- (one row per upload) and are served by GET /api/images/[id].
    -- Locally (no Turso vars) uploads still go to
    -- public/uploads/products/ instead, so this table stays empty.
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mime_type TEXT NOT NULL,
      data BLOB NOT NULL,
      size_bytes INTEGER NOT NULL,
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
    await db.exec("ALTER TABLE orders ADD COLUMN coupon_code TEXT;");
  } catch {}
  try {
    await db.exec("ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0;");
  } catch {}
  try {
    await db.exec("ALTER TABLE orders ADD COLUMN is_gift INTEGER DEFAULT 0;");
  } catch {}
  try {
    await db.exec("ALTER TABLE orders ADD COLUMN recipient_name TEXT;");
  } catch {}
  try {
    await db.exec("ALTER TABLE orders ADD COLUMN recipient_phone TEXT;");
  } catch {}
  try {
    await db.exec("ALTER TABLE orders ADD COLUMN gift_message TEXT;");
  } catch {}
  try {
    await db.exec("ALTER TABLE products ADD COLUMN daily_batch_limit INTEGER DEFAULT 15;");
  } catch {}
  try {
    // Sender number: the bKash/Nagad number the customer paid FROM,
    // captured next to the TrxID so the admin can verify the payment in
    // the wallet app. Old rows get NULL (no sender recorded then).
    await db.exec("ALTER TABLE payment_submissions ADD COLUMN sender_number TEXT;");
  } catch {}
  try {
    // One live TrxID per payment: a partial unique index on the
    // transaction reference for rows still awaiting (or passing) review.
    // Rejected/superseded rows stay outside it, so a corrected re-submit
    // of the same TrxID for the same order still works — the batch
    // rejects the old row before inserting the new one. If an older
    // database already holds two live rows with the same TrxID, this
    // fails and is skipped (the pre-check in the routes still guards the
    // common case); it is created on every fresh database.
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_submissions_trxid_active ON payment_submissions(UPPER(transaction_ref)) WHERE review_state IN ('pending','verified')`);
  } catch {}
}

async function seedInitialData(db: DbHandle) {
  const catCount = (await db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (catCount > 0) return;

  const now = new Date().toISOString();

  // 1. Categories
  const insertCat = await db.prepare(`
    INSERT INTO categories (slug, sort_order, active, name_en, name_bn, description_en, description_bn)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  await insertCat.run('flans-puddings', 1, 1, 'Flans & Puddings', 'ফ্ল্যান ও পুডিং', 'Silky, velvety melt-in-mouth creamy desserts with golden caramel.', 'সোনালী ক্যারামেলের সাথে মুখে মিলিয়ে যাওয়া সিল্কি ক্রিমি ডেজার্ট।');
  await insertCat.run('signature-cakes', 2, 1, 'Signature Cakes', 'স্পেশাল কেক', 'Rich, decadent homemade cakes baked fresh from scratch.', 'খাঁটি মাখনে ও চকলেট গানাশে তৈরি বিশেষ কেক।');
  await insertCat.run('jar-desserts', 3, 1, 'Dessert Jars', 'জার ডেজার্ট', 'Portion-perfect layered dessert jars, easy to share & indulge.', 'স্তরযুক্ত সুস্বাদু ডেজার্ট জার, যেকোনো অনুষ্ঠানের জন্য উপযোগী।');
  await insertCat.run('pastries-tarts', 4, 1, 'Pastries & Tarts', 'পেস্ট্রি ও কাপকেক', 'Artisanal individual pastries and gourmet frosted cupcakes.', 'নরম স্পঞ্জ কাপকেক ও ক্রিস্পি ফ্রুট টার্ট।');
  await insertCat.run('traditional-fusion', 5, 1, 'Traditional & Fusion', 'ঐতিহ্যবাহী ও ফিউশন মিষ্টি', 'Bangladeshi heritage favorites refined with artisanal technique.', 'খাঁটি দুধে জ্বাল দেওয়া ঐতিহ্যবাহী শাহী ফিরনি ও ক্ষীর।');

  // 2. Products
  const insertProd = await db.prepare(`
    INSERT INTO products (
      category_id, slug, status, sort_order, base_price,
      name_en, name_bn, description_en, description_bn,
      ingredients_en, ingredients_bn, allergens_en, allergens_bn,
      lead_time_en, lead_time_bn, image_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVar = await db.prepare(`
    INSERT INTO product_variants (product_id, label_en, label_bn, sku, price_adjustment, active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Product 1: Signature Caramel Custard Flan (Brand Hero)
  await insertProd.run(
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
  await insertVar.run(1, 'Standard (approx. 500g)', 'স্ট্যান্ডার্ড (প্রায় ৫০০ গ্রাম)', 'FLAN-500', 0, 1, 1);
  await insertVar.run(1, 'Family Size (approx. 1kg)', 'ফ্যামিলি সাইজ (প্রায় ১ কেজি)', 'FLAN-1000', 400, 1, 2);

  // Product 2: Royal Chocolate Fudge Cake
  await insertProd.run(
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
  await insertVar.run(2, 'Medium (500g Bento)', 'মিডিয়াম (৫০০ গ্রাম বেন্টো)', 'CAKE-FUDGE-500', 0, 1, 1);
  await insertVar.run(2, 'Full 1 Pound (450-500g)', 'ফুল ১ পাউন্ড', 'CAKE-FUDGE-1LB', 100, 1, 2);
  await insertVar.run(2, 'Large 2 Pound (approx. 1kg)', 'বড় ২ পাউন্ড (১ কেজি)', 'CAKE-FUDGE-2LB', 650, 1, 3);

  // Product 3: Lotus Biscoff Layered Jar Cake
  await insertProd.run(
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
  await insertVar.run(3, 'Single Jar (250ml)', '১টি জার (২৫০ মিলি)', 'JAR-BISC-1', 0, 1, 1);
  await insertVar.run(3, 'Twin Pack (2 Jars - Save ৳30)', 'টুইন প্যাক (২টি জার - ৳৩০ ছাড়)', 'JAR-BISC-2', 250, 1, 2);
  await insertVar.run(3, 'Party Box (4 Jars - Save ৳100)', 'পার্টি বক্স (৪টি জার - ৳১০০ ছাড়)', 'JAR-BISC-4', 740, 1, 3);

  // Product 4: Classic Italian Tiramisu Cup
  await insertProd.run(
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
  await insertProd.run(
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
  await insertProd.run(
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
  await insertVar.run(6, 'Clay Matir Cup (Single 200g)', 'মাটির পাত্রে ১ কাপ (২০০ গ্রাম)', 'FIRNI-1', 0, 1, 1);
  await insertVar.run(6, 'Clay Matir Bowl (Family 500g)', 'মাটির বড় পাত্রে (৫০০ গ্রাম)', 'FIRNI-FAM', 280, 1, 2);

  // Product 7: Velvet Strawberry Cupcakes (Box of 4)
  await insertProd.run(
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
  const insertSetting = await db.prepare(`
    INSERT INTO shop_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
  `);

  await insertSetting.run('service_city', 'Rajshahi', now, 'system');
  await insertSetting.run('coverage_statement_en', 'Fresh homemade delivery available across Rajshahi City', now, 'system');
  await insertSetting.run('coverage_statement_bn', 'রাজশাহী শহরজুড়ে ঘরে তৈরি তাজা ডেজার্ট হোম ডেলিভারি', now, 'system');
  await insertSetting.run('delivery_fee', '50', now, 'system');
  await insertSetting.run('free_delivery_threshold', '1200', now, 'system');
  await insertSetting.run('is_store_paused', 'false', now, 'system');
  await insertSetting.run('pause_message_en', 'Our kitchen is currently fulfilling active orders. New orders will resume shortly!', now, 'system');
  await insertSetting.run('pause_message_bn', 'কিচেনে চাপ বেশি থাকায় সাময়িকভাবে নতুন অর্ডার গ্রহণ বন্ধ রয়েছে। শীঘ্রই অর্ডার নেওয়া শুরু হবে!', now, 'system');
  await insertSetting.run('whatsapp_number', '', now, 'system');
  await insertSetting.run('cod_enabled', 'true', now, 'system');
  await insertSetting.run('bkash_enabled', 'true', now, 'system');
  // Wallet numbers are intentionally left blank here: they must be set by
  // the shop owner in the admin settings. Never seed a real-looking number.
  await insertSetting.run('bkash_number', '', now, 'system');
  await insertSetting.run('bkash_type', 'personal', now, 'system');
  await insertSetting.run('bkash_instructions_en', '1. Open your bKash app and select Send Money.\n2. Send the exact order total to the bKash number shown on your order page.\n3. Complete the payment and copy the Transaction ID (TrxID).\n4. Paste the TrxID on your order page so we can verify it quickly.', now, 'system');
  await insertSetting.run('bkash_instructions_bn', '১. বিকাশ অ্যাপে গিয়ে Send Money নির্বাচন করুন।\n২. অর্ডার পেজে দেখানো বিকাশ নম্বরে সর্বমোট অর্ডারের টাকার পরিমাণ পাঠান।\n৩. পেমেন্ট সম্পন্ন করে TrxID কপি করুন।\n৪. দ্রুত ভেরিফিকেশনের জন্য TrxID অর্ডার পেজে পেস্ট করুন।', now, 'system');
  await insertSetting.run('nagad_enabled', 'true', now, 'system');
  await insertSetting.run('nagad_number', '', now, 'system');
  await insertSetting.run('nagad_type', 'personal', now, 'system');
  await insertSetting.run('nagad_instructions_en', '1. Open your Nagad app and select Send Money.\n2. Send the exact order amount to the Nagad number shown on your order page.\n3. Note down the Transaction ID (TrxID) and enter it on your order page.', now, 'system');
  await insertSetting.run('nagad_instructions_bn', '১. নগদ অ্যাপে গিয়ে Send Money নির্বাচন করুন।\n২. অর্ডার পেজে দেখানো নগদ নম্বরে সঠিক পরিমাণ টাকা পাঠান।\n৩. পেমেন্ট শেষে প্রাপ্ত TrxID অর্ডার পেজে লিখে সাবমিট করুন।', now, 'system');

}

async function seedDefaultCoupons(db: DbHandle) {
  try {
    const couponCount = (await db.prepare('SELECT COUNT(*) as count FROM coupons').get() as { count: number }).count;
    if (couponCount === 0) {
      const now = new Date().toISOString();
      const insertCoupon = await db.prepare(`
        INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, times_used, active, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 1, NULL, ?)
      `);
      await insertCoupon.run('WELCOME50', 'fixed', 50, 400, null, 100, now);
      await insertCoupon.run('SWEETRAJ', 'percentage', 10, 600, 150, 50, now);
      await insertCoupon.run('EIDMUBARAK', 'percentage', 15, 1000, 250, 50, now);
      await insertCoupon.run('SWEETREWARD', 'fixed', 150, 200, null, 5000, now);
    } else {
      const hasReward = await db.prepare('SELECT id FROM coupons WHERE code = ?').get('SWEETREWARD');
      if (!hasReward) {
        const now = new Date().toISOString();
        await db.prepare(`
          INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, times_used, active, expires_at, created_at)
          VALUES ('SWEETREWARD', 'fixed', 150, 200, NULL, 5000, 0, 1, NULL, ?)
        `).run(now);
      }
    }
  } catch {}
}

export async function getShopSettings(): Promise<ShopSettings> {
  const db = await getDb();
  const rows = await db.prepare('SELECT key, value FROM shop_settings').all() as { key: string; value: string }[];
  
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  // Loyalty numbers are admin-editable, so anything unreadable or
  // out of range falls back to the original behaviour (5 / 150 / 200)
  // instead of breaking the reward math.
  const loyaltyInt = (value: string | undefined, fallback: number, min: number, max: number): number => {
    const n = parseInt(value ?? '', 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

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
    loyalty_orders_per_reward: loyaltyInt(map.loyalty_orders_per_reward, 5, 1, 20),
    loyalty_reward_amount: loyaltyInt(map.loyalty_reward_amount, 150, 0, 100000),
    loyalty_reward_min_order: loyaltyInt(map.loyalty_reward_min_order, 200, 0, 100000),
  };
}

export async function updateShopSetting(key: string, value: string, actor: string = 'admin') {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO shop_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `).run(key, value, now, actor);

  await db.prepare(`
    INSERT INTO audit_log (actor, action, entity, details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(actor, 'UPDATE_SETTING', key, `Value set to: ${value.slice(0, 80)}`, now);
}

export async function getCategories(includeInactive: boolean = false): Promise<Category[]> {
  const db = await getDb();
  const query = includeInactive 
    ? 'SELECT * FROM categories ORDER BY sort_order ASC'
    : 'SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC';
  return await db.prepare(query).all() as unknown as Category[];
}

/** URL-safe slug from an English name: lowercased, words joined with '-'. */
export function slugifyCategoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/** How many products (any status except archived) use a category. */
export async function countProductsInCategory(categoryId: number): Promise<number> {
  const db = await getDb();
  const row = await db.prepare(
    `SELECT COUNT(*) as count FROM products WHERE category_id = ? AND status != 'archived'`
  ).get(categoryId) as { count: number } | undefined;
  return Number(row?.count || 0);
}

export async function createCategory(input: {
  name_en: string;
  name_bn: string;
  description_en?: string;
  description_bn?: string;
  sort_order?: number;
  active?: number;
}): Promise<Category> {
  const db = await getDb();
  const slug = slugifyCategoryName(input.name_en);
  if (!slug) throw new Error('Category name must contain letters or numbers for a web address.');
  const existing = await db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  if (existing) throw new Error(`A category with the web address "${slug}" already exists. Please use a different English name.`);
  const sortOrder = input.sort_order ?? ((await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM categories').get() as { m: number }).m + 1);
  const result = await db.prepare(`
    INSERT INTO categories (slug, sort_order, active, name_en, name_bn, description_en, description_bn)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(slug, sortOrder, input.active ?? 1, input.name_en.trim(), input.name_bn.trim(), input.description_en?.trim() || '', input.description_bn?.trim() || '');
  const id = Number(result.lastInsertRowid);
  await db.prepare(`
    INSERT INTO audit_log (actor, action, entity, details, created_at)
    VALUES ('admin', 'CREATE_CATEGORY', ?, ?, ?)
  `).run(`category_${id}`, `Created ${input.name_en}`, new Date().toISOString());
  return await db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as unknown as Category;
}

export async function updateCategory(id: number, input: {
  name_en?: string;
  name_bn?: string;
  description_en?: string;
  description_bn?: string;
  sort_order?: number;
  active?: number;
}): Promise<Category | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  // The slug stays as created (stable web address) even if the name changes.
  await db.prepare(`
    UPDATE categories
    SET name_en = COALESCE(?, name_en),
        name_bn = COALESCE(?, name_bn),
        description_en = COALESCE(?, description_en),
        description_bn = COALESCE(?, description_bn),
        sort_order = COALESCE(?, sort_order),
        active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    input.name_en?.trim() || null,
    input.name_bn?.trim() || null,
    input.description_en?.trim() ?? null,
    input.description_bn?.trim() ?? null,
    input.sort_order ?? null,
    input.active ?? null,
    id
  );
  await db.prepare(`
    INSERT INTO audit_log (actor, action, entity, details, created_at)
    VALUES ('admin', 'UPDATE_CATEGORY', ?, ?, ?)
  `).run(`category_${id}`, 'Category updated', now);
  return await db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as unknown as Category | null;
}

/**
 * Delete a category only when no live product uses it.
 * Returns { deleted: true } or { deleted: false, productCount }.
 */
export async function deleteCategory(id: number): Promise<{ deleted: boolean; productCount: number }> {
  const db = await getDb();
  const productCount = await countProductsInCategory(id);
  if (productCount > 0) return { deleted: false, productCount };
  await db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  await db.prepare(`
    INSERT INTO audit_log (actor, action, entity, details, created_at)
    VALUES ('admin', 'DELETE_CATEGORY', ?, ?, ?)
  `).run(`category_${id}`, 'Category deleted', new Date().toISOString());
  return { deleted: true, productCount: 0 };
}

export async function getProducts(options: { categoryId?: number; status?: string; includeArchived?: boolean } = {}): Promise<Product[]> {
  const db = await getDb();
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

  const products = await db.prepare(sql).all(...params) as unknown as Product[];

  for (const p of products) {
    await attachProductExtras(db, p);
  }

  return products;
}

/** Units of a product already sold today (non-cancelled orders). Drafts
 * (saved, not submitted) never reserve stock, so they are excluded. */
export async function countSoldToday(db: DbHandle, productId: number): Promise<number> {
  const row = await db.prepare(`
    SELECT COALESCE(SUM(oi.quantity), 0) as sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = ?
      AND date(o.created_at) = date('now')
      AND o.order_status != 'cancelled'
      AND o.order_status != 'draft'
  `).get(productId) as { sold: number } | undefined;
  return Number(row?.sold || 0);
}

// Maximum orders one phone number can place per day (all payment
// methods, submitted orders only), tiered by trust: a number that has
// never completed an order gets the low cap, so a flood of prank orders
// to a fresh (or someone else's) number stops at 3; once the number has
// at least one completed order the shop already knows the customer is
// real, so the cap rises to 6 — enough to earn the 5-order reward in a
// single day if they want to. Flood control, not a hard invariant: two
// simultaneous checkouts for the same phone can each pass the pre-check
// and both land (same trade-off as the batch limit). Turn the numbers
// into admin settings later if the shop wants them adjustable.
export const MAX_ORDERS_PER_PHONE_PER_DAY_NEW = 3;
export const MAX_ORDERS_PER_PHONE_PER_DAY_PROVEN = 6;

// Completed orders for this phone number, any day: the trust signal
// behind the tiered daily cap. Drafts and cancelled orders never count.
export async function countCompletedOrders(db: DbHandle, phone: string): Promise<number> {
  const digits = phone.replace(/\D/g, '');
  const fullPhone = digits.length === 13 && digits.startsWith('88') ? digits.slice(2) : digits;
  const row = await db.prepare(`
    SELECT COUNT(*) as completed
    FROM orders
    WHERE substr(replace(replace(customer_phone, ' ', ''), '-', ''), -11) = ?
      AND order_status = 'completed'
  `).get(fullPhone) as { completed: number } | undefined;
  return Number(row?.completed || 0);
}

// The daily order limit that applies to this phone number right now:
// 6 once it has at least one completed order, 3 otherwise. Evaluated
// at the moment of the check, so a customer who places 3 orders today,
// gets one marked completed, and then places a 4th the same day is
// already proven and the 4th goes through.
export async function getDailyOrderLimit(db: DbHandle, phone: string): Promise<number> {
  const completed = await countCompletedOrders(db, phone);
  return completed >= 1 ? MAX_ORDERS_PER_PHONE_PER_DAY_PROVEN : MAX_ORDERS_PER_PHONE_PER_DAY_NEW;
}

// Orders this phone number placed today: non-draft, non-cancelled.
// Drafts do not count (they place nothing yet) and cancelled orders do
// not count (a cancelled order frees its slot). The day boundary is
// UTC (06:00 Dhaka), the same convention as countSoldToday.
export async function countPlacedOrdersToday(db: DbHandle, phone: string): Promise<number> {
  const digits = phone.replace(/\D/g, '');
  const fullPhone = digits.length === 13 && digits.startsWith('88') ? digits.slice(2) : digits;
  const row = await db.prepare(`
    SELECT COUNT(*) as placed
    FROM orders
    WHERE substr(replace(replace(customer_phone, ' ', ''), '-', ''), -11) = ?
      AND order_status != 'draft'
      AND order_status != 'cancelled'
      AND date(created_at) = date('now')
  `).get(fullPhone) as { placed: number } | undefined;
  return Number(row?.placed || 0);
}

/** Attach active variants and today's batch counts to one product row. */
async function attachProductExtras(db: DbHandle, p: Product): Promise<void> {
  const varStmt = await db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort_order ASC');

  p.variants = await varStmt.all(p.id) as unknown as ProductVariant[];
  try {
    const sold = await countSoldToday(db, p.id);
    p.sold_today = sold;
    p.daily_batch_limit = Number(p.daily_batch_limit ?? 15);
    p.remaining_today = Math.max(0, p.daily_batch_limit - sold);
  } catch {
    p.sold_today = 0;
    p.daily_batch_limit = 15;
    p.remaining_today = 15;
  }
}

/**
 * One product by its URL slug, any status (published, sold_out, archived,
 * draft). Callers decide what to show: non-published products render as
 * unavailable and can never be ordered. Returns null for an unknown slug.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = await getDb();
  const product = await db.prepare(`
    SELECT p.*, c.name_en as category_name_en, c.name_bn as category_name_bn
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ?
  `).get(slug) as unknown as Product | null;
  if (!product) return null;
  await attachProductExtras(db, product);
  return product;
}

// Related products for the /menu/:slug page: same category first (up to 4),
// topped up with other published products when the category has too few.
// The current product is always excluded.
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const db = await getDb();
  const sameCategory = await db.prepare(`
    SELECT p.*, c.name_en as category_name_en, c.name_bn as category_name_bn
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'published' AND p.id != ? AND p.category_id = ?
    ORDER BY p.sort_order ASC, p.id ASC
    LIMIT ?
  `).all(product.id, product.category_id, limit) as unknown as Product[];

  const related = sameCategory.slice();
  if (related.length < limit) {
    const excludeIds = [product.id, ...related.map((p) => p.id)];
    const fillers = await db.prepare(`
      SELECT p.*, c.name_en as category_name_en, c.name_bn as category_name_bn
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'published' AND p.id NOT IN (${excludeIds.map(() => '?').join(',')})
      ORDER BY p.sort_order ASC, p.id ASC
      LIMIT ?
    `).all(...excludeIds, limit - related.length) as unknown as Product[];
    related.push(...fillers);
  }

  for (const p of related) await attachProductExtras(db, p);
  return related;
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
export async function generateUniquePublicOrderCode(db: DbHandle, maxAttempts = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generatePublicOrderCode();
    const existing = await db.prepare('SELECT 1 FROM orders WHERE public_code = ?').get(code);
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

/**
 * Sender-number validation: the bKash/Nagad number the customer paid
 * FROM, captured next to the TrxID. Normalised like any phone (spaces /
 * dashes stripped, a leading 88 country code dropped), then it must be
 * an 11-digit Bangladeshi mobile starting with 01. Returns the
 * normalised number, or null when the value is missing or invalid.
 * The duplicate-TrxID check is unchanged: a duplicate is decided by
 * TrxID alone, never by sender number.
 */
export function normalizeSenderNumber(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const digits = normalizePhone(raw);
  return /^01\d{9}$/.test(digits) ? digits : null;
}

/**
 * A TrxID is proof of ONE payment: the same TrxID must never be accepted
 * for two different orders. Find another order that already carries this
 * TrxID (trimmed, case-insensitive — bKash/Nagad TrxIDs are ASCII, so
 * SQLite's UPPER() folds them correctly). Covers every review state:
 * a TrxID that is pending, verified, or already judged not-received
 * (rejected) on another order is not reusable anywhere else.
 * The same order is excluded: re-submitting a TrxID for the order that
 * already has it (double-tap / correction) stays allowed — the existing
 * supersede logic handles that. Callers MUST call this inside the
 * transaction that inserts the submission, with the transaction handle,
 * so two simultaneous submits cannot both pass the check.
 * Returns the other order's id + public code, or null when unused.
 */
export async function findTrxIdConflict(
  db: DbHandle,
  trxId: string,
  excludeOrderId?: number
): Promise<{ orderId: number; publicCode: string } | null> {
  const ref = trxId.trim();
  if (!ref) return null;
  const row = await db.prepare(`
    SELECT o.id as order_id, o.public_code as public_code
    FROM payment_submissions ps
    JOIN orders o ON o.id = ps.order_id
    WHERE UPPER(ps.transaction_ref) = UPPER(?) AND ps.order_id != ?
    LIMIT 1
  `).get(ref, excludeOrderId ?? -1) as { order_id: number; public_code: string } | undefined;
  return row ? { orderId: Number(row.order_id), publicCode: row.public_code } : null;
}

export async function getOrderWithDetails(publicCode: string, phoneFilter?: string): Promise<Order | null> {
  // Phone verification is mandatory: without a matching phone number the
  // order is not returned, and callers cannot tell whether the code exists.
  const normalizedFilter = phoneFilter ? normalizePhone(phoneFilter) : '';
  if (!normalizedFilter) return null;

  const db = await getDb();
  const order = await db.prepare('SELECT * FROM orders WHERE public_code = ?').get(publicCode) as unknown as Order | null;
  if (!order) return null;
  if (normalizePhone(order.customer_phone) !== normalizedFilter) return null;

  order.items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as unknown as OrderItem[];
  order.events = await db.prepare('SELECT * FROM order_status_events WHERE order_id = ? ORDER BY created_at ASC').all(order.id) as unknown as OrderStatusEvent[];
  order.payment_submissions = await db.prepare('SELECT * FROM payment_submissions WHERE order_id = ? ORDER BY submitted_at DESC').all(order.id) as unknown as PaymentSubmission[];

  return order;
}

export async function getAllOrders(filterStatus?: string): Promise<Order[]> {
  const db = await getDb();
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

  const orders = await db.prepare(sql).all(...params) as unknown as Order[];
  if (!orders || orders.length === 0) {
    return [];
  }

  // Batch query to eliminate N+1 database roundtrips
  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(',');

  const allItems = await db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
    .all(...orderIds) as unknown as OrderItem[];

  const allEvents = await db
    .prepare(`SELECT * FROM order_status_events WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...orderIds) as unknown as OrderStatusEvent[];

  const allPayments = await db
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

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const db = await getDb();
  const cleanCode = code.trim().toUpperCase();
  const coupon = await db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ?').get(cleanCode) as unknown as Coupon | null;
  return coupon;
}

/**
 * Reserve one coupon use, on the given handle: the counter only moves
 * when the coupon still has uses left, so two orders racing at the
 * usage limit cannot both redeem. Returns false when the coupon is
 * already exhausted.
 *
 * Takes the handle explicitly (and is called BEFORE the order batch, on
 * the outer handle) because the old helper opened its own connection
 * mid-transaction: inside a Turso interactive transaction it ran on the
 * OUTER handle, outside the transaction it was supposed to belong to.
 * Callers release the reservation (releaseCouponUse) when the batch
 * that was supposed to consume it fails, so a failed order never eats
 * a coupon use.
 */
export async function reserveCouponUse(db: DbHandle, code: string): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase();
  // Atomic reservation: the counter only moves when the coupon still has
  // uses left, so two orders racing at the usage limit cannot both redeem.
  // Returns false when the coupon is already exhausted.
  const result = await db.prepare(
    'UPDATE coupons SET times_used = times_used + 1 WHERE UPPER(code) = ? AND (usage_limit IS NULL OR times_used < usage_limit)'
  ).run(cleanCode);
  return result.changes > 0;
}

/** Undo a coupon reservation (best-effort compensation when the batch that was supposed to consume it fails). */
export async function releaseCouponUse(db: DbHandle, code: string): Promise<void> {
  try {
    await db.prepare(
      'UPDATE coupons SET times_used = MAX(times_used - 1, 0) WHERE UPPER(code) = ?'
    ).run(code.trim().toUpperCase());
  } catch {
    // Best-effort only: the batch failure is the error that matters, not the compensation.
  }
}

export async function getAllCoupons(): Promise<Coupon[]> {
  const db = await getDb();
  return await db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() as unknown as Coupon[];
}

export async function createCoupon(data: {
  code: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  expiresAt?: string | null;
}): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.prepare(`
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

export async function toggleCouponStatus(id: number, active: number): Promise<void> {
  const db = await getDb();
  await db.prepare('UPDATE coupons SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

export async function deleteCoupon(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
}

export async function getCustomerLoyalty(phone: string): Promise<LoyaltyInfo> {
  const db = await getDb();
  // Full 11-digit number only (e.g. 01712345678). Stored numbers are
  // digits-only and may carry the 88 country prefix, so match on the
  // last 11 digits. Short or partial numbers never match — a few digits
  // must not reveal another customer's name, orders or spending.
  const digits = phone.replace(/\D/g, '');
  const fullPhone = digits.length === 13 && digits.startsWith('88') ? digits.slice(2) : digits;
  const validPhone = /^01[3-9]\d{8}$/.test(fullPhone) ? fullPhone : '';

  const phoneMatch = `substr(replace(replace(customer_phone, ' ', ''), '-', ''), -11) = ?`;
  // Drafts (saved, not submitted) are not orders yet: they count toward
  // no loyalty total, no spend, and never consume a reward.
  const row = await db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN order_status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END) as total_spent,
      (SELECT customer_name FROM orders WHERE ${phoneMatch} ORDER BY id DESC LIMIT 1) as customer_name
    FROM orders 
    WHERE ${phoneMatch} AND order_status != 'draft'
  `).get(validPhone, validPhone) as {
    total_orders: number;
    completed_orders: number;
    total_spent: number;
    customer_name: string | null;
  } | undefined;

  const completed = Number(row?.completed_orders || 0);
  // Orders per reward comes from the admin-editable loyalty settings
  // (default 5). Tier thresholds below are fixed and do NOT follow it.
  const loyaltySettings = await getShopSettings();
  const perReward = loyaltySettings.loyalty_orders_per_reward;
  const stamps = completed % perReward;
  const stampsToNext = stamps === 0 && completed > 0 ? 0 : perReward - stamps;
  const rewardsEarned = Math.floor(completed / perReward);

  // Rewards already used up: non-cancelled, non-draft orders that redeemed the
  // loyalty reward code. A reward is only available when earned > used.
  const redeemedRow = await db.prepare(`
    SELECT COUNT(*) as redeemed FROM orders
    WHERE ${phoneMatch} AND coupon_code = 'SWEETREWARD' AND order_status != 'cancelled' AND order_status != 'draft'
  `).get(validPhone) as { redeemed: number } | undefined;
  const rewardsRedeemed = Number(redeemedRow?.redeemed || 0);
  const rewardsAvailable = Math.max(0, rewardsEarned - rewardsRedeemed);

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
    phone: fullPhone,
    customerName: row?.customer_name || null,
    totalOrders: Number(row?.total_orders || 0),
    completedOrders: completed,
    totalSpent: Number(row?.total_spent || 0),
    stamps,
    stampsNeeded: perReward,
    stampsToNextReward: stampsToNext,
    rewardsEarned,
    rewardsAvailable,
    tier,
    tierBn,
    rewardCouponCode: 'SWEETREWARD',
    rewardAmount: loyaltySettings.loyalty_reward_amount,
    rewardMinOrder: loyaltySettings.loyalty_reward_min_order,
  };
}

/**
 * Keep the SWEETREWARD coupon row in step with the admin-editable
 * loyalty settings (discount amount + minimum order). Call after the
 * loyalty settings are saved or restored. UPDATE only: it never
 * resurrects a coupon the owner deliberately deleted — the seed's
 * "insert only if missing" guard still owns creation.
 */
export async function syncLoyaltyRewardCoupon(): Promise<void> {
  const settings = await getShopSettings();
  const db = await getDb();
  await db.prepare(`
    UPDATE coupons SET discount_value = ?, min_order_amount = ?
    WHERE code = 'SWEETREWARD'
  `).run(settings.loyalty_reward_amount, settings.loyalty_reward_min_order);
}
