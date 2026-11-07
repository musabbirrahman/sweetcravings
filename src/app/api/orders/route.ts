import { NextResponse } from 'next/server';
import { 
  getDb, 
  generatePublicOrderCode, 
  getShopSettings, 
  getAllOrders, 
  getCouponByCode, 
  incrementCouponUsage 
} from '@/lib/db';
import { Product, ProductVariant } from '@/lib/types';
import { verifyAdminSession } from '@/lib/auth';
import { notifyKitchenNewOrder } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      areaLandmark,
      deliveryInstructions,
      paymentMethod,
      items,
      trxId,
      idempotencyToken,
      couponCode,
      isGift,
      recipientName,
      recipientPhone,
      giftMessage,
    } = body;
    const requestedTime = body.requestedTime || body.requestedDeliveryTime || null;

    // Check store paused status
    const settings = getShopSettings();
    if (settings.is_store_paused) {
      return NextResponse.json({
        success: false,
        error: 'The kitchen is temporarily paused for orders. Please try again shortly.',
      }, { status: 400 });
    }

    // Required field validation
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return NextResponse.json({ success: false, error: 'Customer name is required' }, { status: 400 });
    }
    if (customerName.length > 100) {
      return NextResponse.json({ success: false, error: 'Customer name exceeds maximum length' }, { status: 400 });
    }

    if (!customerPhone || typeof customerPhone !== 'string' || !customerPhone.trim()) {
      return NextResponse.json({ success: false, error: 'Customer phone number is required' }, { status: 400 });
    }
    
    // Strict Bangladesh Phone Validation
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!/^(?:88)?01[3-9]\d{8}$/.test(cleanPhone)) {
      return NextResponse.json({
        success: false,
        error: 'Please enter a valid 11-digit Bangladesh phone number (e.g. 01712345678).'
      }, { status: 400 });
    }

    if (!deliveryAddress || typeof deliveryAddress !== 'string' || !deliveryAddress.trim()) {
      return NextResponse.json({ success: false, error: 'Delivery address is required' }, { status: 400 });
    }
    if (deliveryAddress.length > 500) {
      return NextResponse.json({ success: false, error: 'Delivery address exceeds maximum length' }, { status: 400 });
    }

    if (!areaLandmark || typeof areaLandmark !== 'string' || !areaLandmark.trim()) {
      return NextResponse.json({ success: false, error: 'Rajshahi area/landmark is required' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Cart cannot be empty' }, { status: 400 });
    }

    if (items.length > 25) {
      return NextResponse.json({ success: false, error: 'Too many distinct items in a single order' }, { status: 400 });
    }

    const db = getDb();

    // Idempotency check: prevent duplicate submits
    if (idempotencyToken) {
      const existing = db.prepare('SELECT public_code, subtotal, delivery_fee, total_amount, discount_amount, coupon_code FROM orders WHERE idempotency_token = ?').get(idempotencyToken) as any;
      if (existing) {
        return NextResponse.json({
          success: true,
          publicCode: existing.public_code,
          subtotal: existing.subtotal,
          deliveryFee: existing.delivery_fee,
          totalAmount: existing.total_amount,
          discountAmount: existing.discount_amount || 0,
          couponCode: existing.coupon_code || null,
          isDuplicateSubmission: true,
        });
      }
    }

    // SERVER-SIDE PRICING RECALCULATION
    let subtotal = 0;
    const validatedItems: Array<{
      productId: number;
      nameEn: string;
      nameBn: string;
      variantLabelEn: string;
      variantLabelBn: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
    }> = [];

    const prodStmt = db.prepare('SELECT * FROM products WHERE id = ?');
    const varStmt = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?');

    for (const item of items) {
      // Impose a safe maximum of 50 units per line item
      const qty = Math.min(50, Math.max(1, parseInt(item.quantity || 1, 10)));
      const product = prodStmt.get(item.productId) as unknown as Product | null;
      if (!product) {
        return NextResponse.json({ success: false, error: `Product ID ${item.productId} not found` }, { status: 400 });
      }

      let unitPrice = product.base_price;
      let varLabelEn = '';
      let varLabelBn = '';

      if (item.variantId) {
        const variant = varStmt.get(item.variantId, product.id) as unknown as ProductVariant | null;
        if (variant) {
          unitPrice += variant.price_adjustment;
          varLabelEn = variant.label_en;
          varLabelBn = variant.label_bn;
        }
      }

      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      validatedItems.push({
        productId: product.id,
        nameEn: product.name_en,
        nameBn: product.name_bn,
        variantLabelEn: varLabelEn,
        variantLabelBn: varLabelBn,
        unitPrice,
        quantity: qty,
        lineTotal,
      });
    }

    // Validate coupon if provided
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const coupon = getCouponByCode(couponCode.trim());
      if (coupon && coupon.active) {
        const isExpired = coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false;
        const isOverLimit = coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit;
        const meetsMin = subtotal >= coupon.min_order_amount;

        if (!isExpired && !isOverLimit && meetsMin) {
          if (coupon.discount_type === 'fixed') {
            discountAmount = Math.min(subtotal, coupon.discount_value);
          } else if (coupon.discount_type === 'percentage') {
            let raw = Math.round((subtotal * coupon.discount_value) / 100);
            if (coupon.max_discount_amount) {
              raw = Math.min(raw, coupon.max_discount_amount);
            }
            discountAmount = Math.min(subtotal, raw);
          }
          appliedCouponCode = coupon.code;
        }
      }
    }

    // Recalculate delivery fee
    const deliveryFee = subtotal >= settings.free_delivery_threshold ? 0 : settings.delivery_fee;
    const totalAmount = Math.max(0, subtotal - discountAmount) + deliveryFee;

    const publicCode = generatePublicOrderCode();
    const now = new Date().toISOString();
    const token = idempotencyToken || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const initialPaymentStatus = (paymentMethod === 'bkash' || paymentMethod === 'nagad') && trxId && String(trxId).trim()
      ? 'submitted'
      : 'pending';

    // ATOMIC TRANSACTION: Insert order, items, status event, and payment submission together
    db.exec('BEGIN TRANSACTION;');

    let orderId: number;

    try {
      const insertOrder = db.prepare(`
        INSERT INTO orders (
          public_code, customer_name, customer_phone, delivery_address, area_landmark,
          delivery_instructions, requested_time, is_gift, recipient_name, recipient_phone, gift_message,
          payment_method, payment_status, order_status,
          subtotal, delivery_fee, discount_amount, coupon_code, total_amount, idempotency_token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertOrder.run(
        publicCode,
        customerName.trim(),
        cleanPhone,
        deliveryAddress.trim(),
        areaLandmark.trim(),
        deliveryInstructions ? String(deliveryInstructions).trim().slice(0, 500) : '',
        requestedTime ? String(requestedTime).trim().slice(0, 100) : '',
        isGift ? 1 : 0,
        recipientName ? String(recipientName).trim().slice(0, 100) : null,
        recipientPhone ? String(recipientPhone).trim().slice(0, 20) : null,
        giftMessage ? String(giftMessage).trim().slice(0, 500) : null,
        paymentMethod || 'cod',
        initialPaymentStatus,
        'new',
        subtotal,
        deliveryFee,
        discountAmount,
        appliedCouponCode,
        totalAmount,
        token,
        now,
        now
      );

      orderId = Number(result.lastInsertRowid);

      // Insert order items
      const insertItem = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name_en, product_name_bn,
          variant_label_en, variant_label_bn, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const vItem of validatedItems) {
        insertItem.run(
          orderId,
          vItem.productId,
          vItem.nameEn,
          vItem.nameBn,
          vItem.variantLabelEn,
          vItem.variantLabelBn,
          vItem.unitPrice,
          vItem.quantity,
          vItem.lineTotal
        );
      }

      // Insert initial status event
      db.prepare(`
        INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderId, 'none', 'new', 'customer', 'Order placed through website', now);

      // Insert payment submission if TrxID provided
      if (trxId && String(trxId).trim() && (paymentMethod === 'bkash' || paymentMethod === 'nagad')) {
        db.prepare(`
          INSERT INTO payment_submissions (order_id, provider, transaction_ref, claimed_amount, submitted_at, review_state)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(orderId, paymentMethod, String(trxId).trim().slice(0, 50), totalAmount, now, 'pending');
      }

      // Increment coupon usage
      if (appliedCouponCode) {
        incrementCouponUsage(appliedCouponCode);
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    // Non-blocking Kitchen Instant Notification Dispatch
    notifyKitchenNewOrder({
      order: {
        public_code: publicCode,
        customer_name: customerName.trim(),
        customer_phone: cleanPhone,
        area_landmark: areaLandmark.trim(),
        delivery_address: deliveryAddress.trim(),
        delivery_instructions: deliveryInstructions ? String(deliveryInstructions).trim() : undefined,
        is_gift: Boolean(isGift),
        recipient_name: recipientName ? String(recipientName).trim() : null,
        recipient_phone: recipientPhone ? String(recipientPhone).trim() : null,
        gift_message: giftMessage ? String(giftMessage).trim() : null,
        payment_method: paymentMethod || 'cod',
        total_amount: totalAmount,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        coupon_code: appliedCouponCode,
      },
      items: validatedItems,
    }).catch((err) => console.error('Kitchen notification dispatch failed:', err));

    return NextResponse.json({
      success: true,
      orderId,
      publicCode,
      subtotal,
      deliveryFee,
      discountAmount,
      couponCode: appliedCouponCode,
      totalAmount,
    });
  } catch (error: any) {
    console.error('Error placing order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PROTECTED: Only authenticated operator can view all orders
export async function GET(request: Request) {
  try {
    const isAuthed = verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Operator session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status') || undefined;

    const orders = getAllOrders(filterStatus);
    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
