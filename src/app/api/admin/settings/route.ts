import { NextResponse } from 'next/server';
import { getShopSettings, updateShopSetting, getDb } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const backup = searchParams.get('backup');

    const db = await getDb();

    // If backup export requested: dump all tables as JSON backup
    if (backup === 'true') {
      const categories = await db.prepare('SELECT * FROM categories').all();
      const products = await db.prepare('SELECT * FROM products').all();
      const variants = await db.prepare('SELECT * FROM product_variants').all();
      const orders = await db.prepare('SELECT * FROM orders').all();
      const orderItems = await db.prepare('SELECT * FROM order_items').all();
      const paymentSubmissions = await db.prepare('SELECT * FROM payment_submissions').all();
      const events = await db.prepare('SELECT * FROM order_status_events').all();
      const settings = await db.prepare('SELECT * FROM shop_settings').all();
      const auditLog = await db.prepare('SELECT * FROM audit_log').all();

      const dump = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        brand: 'Sweet Cravings Rajshahi',
        data: {
          categories,
          products,
          variants,
          orders,
          orderItems,
          paymentSubmissions,
          events,
          settings,
          auditLog,
        }
      };

      return new Response(JSON.stringify(dump, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="sweetcravings_backup_${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    const settings = await getShopSettings();
    const auditLogs = await db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 20').all();

    return NextResponse.json({
      success: true,
      settings,
      auditLogs,
    });
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
    const { settings, actor = 'Sister / Owner' } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid settings payload' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings)) {
      await updateShopSetting(key, String(value), actor);
    }

    const updated = await getShopSettings();
    return NextResponse.json({
      success: true,
      settings: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
