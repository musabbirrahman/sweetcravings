import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getDb } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

// The only order statuses the admin panel may set. Anything else is a
// client bug or a tampered request — reject it rather than storing a
// status nothing in the app understands.
const ALLOWED_ORDER_STATUSES: readonly OrderStatus[] = [
  'new',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
  'draft',
];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-order:${ip}`, 120, 60 * 1000);
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

    const orderId = parseInt(params.id, 10);
    const body = await request.json();
    const { orderStatus, paymentStatus, note, adminName = 'Sister / Owner' } = body;

    const db = await getDb();
    const current = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;

    if (!current) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    let updatedOrderStatus = current.order_status;
    let updatedPaymentStatus = current.payment_status;

    // Reject unknown order statuses outright: only the OrderStatus
    // union may be stored. The draft guard below stays as it is.
    if (orderStatus && !(ALLOWED_ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid order status.' }, { status: 400 });
    }

    // A saved draft is not an order yet: it can only be cancelled (to
    // clear it). It must never be moved to the kitchen or have its
    // payment confirmed — it becomes a real order only when the customer
    // submits the TrxID.
    if (current.order_status === 'draft') {
      if (orderStatus && orderStatus !== 'cancelled') {
        return NextResponse.json({ success: false, error: 'A saved draft cannot be moved to the kitchen. It must be submitted with a TrxID first, or cancelled.' }, { status: 400 });
      }
      if (paymentStatus && paymentStatus !== current.payment_status) {
        return NextResponse.json({ success: false, error: 'A saved draft has no payment to confirm yet.' }, { status: 400 });
      }
    }

    if (orderStatus && orderStatus !== current.order_status) {
      updatedOrderStatus = orderStatus;
      await db.prepare(`
        INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderId, current.order_status, orderStatus, adminName, note || `Status changed to ${orderStatus}`, now);
    }

    if (paymentStatus && paymentStatus !== current.payment_status) {
      updatedPaymentStatus = paymentStatus;
      await db.prepare(`
        INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderId, current.payment_status, paymentStatus, adminName, note || `Payment marked as ${paymentStatus}`, now);

      // If payment is confirmed or rejected, update the latest payment submission review state
      if (paymentStatus === 'confirmed' || paymentStatus === 'rejected') {
        const reviewState = paymentStatus === 'confirmed' ? 'verified' : 'rejected';
        await db.prepare(`
          UPDATE payment_submissions 
          SET review_state = ?, reviewed_at = ?, reviewer = ?
          WHERE order_id = ? AND review_state = 'pending'
        `).run(reviewState, now, adminName, orderId);
      }
    }

    await db.prepare(`
      UPDATE orders
      SET order_status = ?, payment_status = ?, updated_at = ?
      WHERE id = ?
    `).run(updatedOrderStatus, updatedPaymentStatus, now, orderId);

    // Audit log
    await db.prepare(`
      INSERT INTO audit_log (actor, action, entity, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminName, 'UPDATE_ORDER', `order_${orderId}`, `Order: ${updatedOrderStatus}, Payment: ${updatedPaymentStatus}`, now);

    return NextResponse.json({
      success: true,
      orderStatus: updatedOrderStatus,
      paymentStatus: updatedPaymentStatus,
    });
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
