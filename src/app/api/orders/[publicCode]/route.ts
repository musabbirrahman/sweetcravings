import { NextResponse } from 'next/server';
import { getOrderWithDetails, getDb, getShopSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { publicCode: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone') || undefined;

    const order = getOrderWithDetails(params.publicCode, phone);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found or phone number does not match.' },
        { status: 404 }
      );
    }

    const settings = getShopSettings();

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
    const body = await request.json();
    const { trxId, provider } = body;

    if (!trxId || !trxId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID (TrxID) is required.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const order = db.prepare('SELECT id, total_amount, payment_method FROM orders WHERE public_code = ?').get(params.publicCode) as { id: number; total_amount: number; payment_method: string } | null;

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const prov = provider || order.payment_method || 'bkash';

    // Insert new payment submission record
    db.prepare(`
      INSERT INTO payment_submissions (order_id, provider, transaction_ref, claimed_amount, submitted_at, review_state)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(order.id, prov, trxId.trim(), order.total_amount, now, 'pending');

    // Update order payment status to 'submitted'
    db.prepare(`
      UPDATE orders
      SET payment_status = 'submitted', updated_at = ?
      WHERE id = ?
    `).run(now, order.id);

    // Record audit event
    db.prepare(`
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
