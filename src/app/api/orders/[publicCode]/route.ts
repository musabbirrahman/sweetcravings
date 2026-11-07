import { NextResponse } from 'next/server';
import { getOrderWithDetails, getDb, getShopSettings, normalizePhone } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// A missing or wrong phone returns the same generic "not found" as a
// missing code, so callers cannot probe whether an order code exists.
const NOT_FOUND = { success: false, error: 'Order not found.' };

export async function GET(
  request: Request,
  { params }: { params: { publicCode: string } }
) {
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`order-lookup:${ip}`, 30, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone') || '';
    if (!phone.trim()) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const order = await getOrderWithDetails(params.publicCode, phone);

    if (!order) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const settings = await getShopSettings();

    return NextResponse.json({
      success: true,
      order,
      settings: {
        bkash_number: settings.bkash_number,
        bkash_type: settings.bkash_type,
        nagad_number: settings.nagad_number,
        nagad_type: settings.nagad_type,
        whatsapp_number: settings.whatsapp_number,
      }
    });
  } catch (error: any) {
    console.error('Error fetching order by code:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { publicCode: string } }
) {
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`order-trxid:${ip}`, 10, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { trxId, provider, phone } = body;

    if (!trxId || typeof trxId !== 'string' || !trxId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID (TrxID) is required.' },
        { status: 400 }
      );
    }
    if (trxId.trim().length > 50) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is too long.' },
        { status: 400 }
      );
    }

    // Phone verification is mandatory before a TrxID can be attached.
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const db = await getDb();
    const order = await db.prepare('SELECT id, total_amount, payment_method, payment_status, customer_phone FROM orders WHERE public_code = ?').get(params.publicCode) as { id: number; total_amount: number; payment_method: string; payment_status: string; customer_phone: string } | null;

    if (!order || normalizePhone(order.customer_phone) !== normalizePhone(phone)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    if (order.payment_method === 'cod') {
      return NextResponse.json(
        { success: false, error: 'This order uses Cash on Delivery; no transaction ID is needed.' },
        { status: 400 }
      );
    }

    if (order.payment_status === 'confirmed') {
      return NextResponse.json(
        { success: false, error: 'Payment for this order is already confirmed.' },
        { status: 400 }
      );
    }

    const prov = provider || order.payment_method;
    if (prov !== 'bkash' && prov !== 'nagad') {
      return NextResponse.json(
        { success: false, error: 'Payment provider must be bKash or Nagad.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Insert new payment submission record
    await db.prepare(`
      INSERT INTO payment_submissions (order_id, provider, transaction_ref, claimed_amount, submitted_at, review_state)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(order.id, prov, trxId.trim(), order.total_amount, now, 'pending');

    // Update order payment status to 'submitted'
    await db.prepare(`
      UPDATE orders
      SET payment_status = 'submitted', updated_at = ?
      WHERE id = ?
    `).run(now, order.id);

    // Record audit event
    await db.prepare(`
      INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(order.id, 'payment_update', 'submitted', 'customer', `Customer submitted TrxID: ${trxId.trim()} (${prov})`, now);

    return NextResponse.json({
      success: true,
      message: 'Transaction ID submitted successfully.',
    });
  } catch (error: any) {
    console.error('Error updating transaction ID:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
