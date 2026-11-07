import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
