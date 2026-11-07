import { NextResponse } from 'next/server';
import { 
  getDb, 
  generateUniquePublicOrderCode, 
  getShopSettings, 
  getAllOrders, 
  getCouponByCode, 
  getCustomerLoyalty,
  incrementCouponUsage,
  countSoldToday 
} from '@/lib/db';
import { Product, ProductVariant } from '@/lib/types';
import { verifyAdminSession } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { notifyKitchenNewOrder } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const ALLOWED_PAYMENT_METHODS = ['cod', 'bkash', 'nagad'] as const;

export async function POST(request: Request) {
  // Set inside the order transaction when a coupon's last use is taken by
  // another order first; the catch below turns it into a clear 400.
  let couponExhausted = false;
  // Same pattern for the daily batch limit (see the in-transaction check).
  let batchLimitExceeded = false;
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`order-create:${ip}`, 10, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many order attempts. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
        { status: 429 }
      );
    }

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

    // Payment method must be one of the supported methods, and that method
    // must be enabled (and, for wallets, configured with a number). The
    // storefront hides unavailable methods; the server enforces it.
    if (!paymentMethod || typeof paymentMethod !== 'string' || !(ALLOWED_PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
      return NextResponse.json({ success: false, error: 'Please choose a valid payment method (Cash on Delivery, bKash or Nagad).' }, { status: 400 });
    }
    if (paymentMethod === 'cod' && !settings.cod_enabled) {
      return NextResponse.json({ success: false, error: 'Cash on Delivery is currently unavailable. Please choose another payment method.' }, { status: 400 });
    }
    if (paymentMethod === 'bkash') {
      if (!settings.bkash_enabled) {
        return NextResponse.json({ success: false, error: 'bKash payment is currently unavailable. Please choose another payment method.' }, { status: 400 });
      }
      if (!settings.bkash_number || !settings.bkash_number.trim()) {
        return NextResponse.json({ success: false, error: 'bKash payment is not set up yet. Please choose Cash on Delivery or contact the shop.' }, { status: 400 });
      }
    }
    if (paymentMethod === 'nagad') {
      if (!settings.nagad_enabled) {
        return NextResponse.json({ success: false, error: 'Nagad payment is currently unavailable. Please choose another payment method.' }, { status: 400 });
      }
      if (!settings.nagad_number || !settings.nagad_number.trim()) {
        return NextResponse.json({ success: false, error: 'Nagad payment is not set up yet. Please choose Cash on Delivery or contact the shop.' }, { status: 400 });
      }
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
      // Only published products can be ordered. Sold-out, archived and
      // draft products must be rejected server-side, not just hidden in UI.
      if (product.status !== 'published') {
        return NextResponse.json({ success: false, error: `${product.name_en} is not available for ordering right now.` }, { status: 400 });
      }

      // Daily batch limit: a product can only sell its daily batch. The
      // storefront shows how many are left; the server enforces it, so a
      // batch that sold out cannot be ordered by any route.
      const dailyLimit = Number(product.daily_batch_limit ?? 15);
      const soldToday = countSoldToday(db, product.id);
      if (soldToday + qty > dailyLimit) {
        const remaining = Math.max(0, dailyLimit - soldToday);
        return NextResponse.json({
          success: false,
          error: `${product.name_en} has reached today's batch limit (only ${remaining} left today). Please try again tomorrow or choose another dessert.`,
        }, { status: 400 });
      }

      let unitPrice = product.base_price;
      let varLabelEn = '';
      let varLabelBn = '';

      if (item.variantId) {
        const variant = varStmt.get(item.variantId, product.id) as unknown as ProductVariant | null;
        if (!variant) {
          return NextResponse.json({ success: false, error: 'The selected option is no longer available. Please refresh the menu and try again.' }, { status: 400 });
        }
        if (variant.active !== 1) {
          return NextResponse.json({ success: false, error: 'The selected option is no longer available. Please refresh the menu and try again.' }, { status: 400 });
        }
        unitPrice += variant.price_adjustment;
        varLabelEn = variant.label_en;
        varLabelBn = variant.label_bn;
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

    // Validate coupon if provided. A code the customer typed in must
    // either apply or stop the order with a clear reason — never silently
    // charge full price while the customer believes a discount applied.
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const coupon = getCouponByCode(couponCode.trim());
      if (!coupon) {
        return NextResponse.json({ success: false, error: 'This coupon code is not recognised.' }, { status: 400 });
      }
      if (!coupon.active) {
        return NextResponse.json({ success: false, error: 'This coupon is currently inactive.' }, { status: 400 });
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        return NextResponse.json({ success: false, error: 'This coupon has expired.' }, { status: 400 });
      }
      if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
        return NextResponse.json({ success: false, error: 'This coupon has reached its maximum usage limit.' }, { status: 400 });
      }
      if (subtotal < coupon.min_order_amount) {
        return NextResponse.json({ success: false, error: `Minimum order amount of ৳${coupon.min_order_amount} required to use this coupon.` }, { status: 400 });
      }
      // The loyalty reward code is earned, not public: one reward per
      // 5 completed orders, and each earned reward can be used only once.
      if (coupon.code === 'SWEETREWARD') {
        const loyalty = getCustomerLoyalty(cleanPhone);
        if (loyalty.rewardsAvailable <= 0) {
          return NextResponse.json({ success: false, error: 'The Sweet Reward unlocks after 5 completed orders, and each reward can be used only once.' }, { status: 400 });
        }
      }

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

    // Recalculate delivery fee
    const deliveryFee = subtotal >= settings.free_delivery_threshold ? 0 : settings.delivery_fee;
    const totalAmount = Math.max(0, subtotal - discountAmount) + deliveryFee;

    const now = new Date().toISOString();
    const token = idempotencyToken || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const initialPaymentStatus = (paymentMethod === 'bkash' || paymentMethod === 'nagad') && trxId && String(trxId).trim()
      ? 'submitted'
      : 'pending';

    // ATOMIC TRANSACTION: Insert order, items, status event, and payment submission together.
    // Retries with a fresh public code if the (very unlikely) random code
    // collides with an existing order; any other failure aborts at once.
    let orderId: number = 0;
    let publicCode = '';
    let lastTxError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      publicCode = generateUniquePublicOrderCode(db);
      db.exec('BEGIN TRANSACTION;');

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

        // Re-check the batch limit inside the transaction: another order
        // may have taken the last units after the pre-check above. Aborts
        // the whole order instead of overselling the batch.
        for (const vItem of validatedItems) {
          const limitRow = db.prepare('SELECT daily_batch_limit FROM products WHERE id = ?').get(vItem.productId) as { daily_batch_limit: number | null } | undefined;
          const limit = Number(limitRow?.daily_batch_limit ?? 15);
          if (countSoldToday(db, vItem.productId) + vItem.quantity > limit) {
            batchLimitExceeded = true;
            throw new Error('BATCH_LIMIT_EXCEEDED');
          }
        }

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

        // Reserve one coupon use atomically. If another order just took
        // the last use, abort this order instead of charging full price
        // while the customer believed a discount applied.
        if (appliedCouponCode) {
          if (!incrementCouponUsage(appliedCouponCode)) {
            couponExhausted = true;
            throw new Error('COUPON_EXHAUSTED');
          }
        }

        db.exec('COMMIT;');
        lastTxError = null;
        break;
      } catch (txErr) {
        try { db.exec('ROLLBACK;'); } catch {}
        const message = txErr instanceof Error ? txErr.message : String(txErr);
        if (message.includes('UNIQUE constraint failed') && message.includes('public_code')) {
          lastTxError = txErr;
          continue;
        }
        throw txErr;
      }
    }

    if (lastTxError) {
      throw lastTxError;
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
    if (couponExhausted) {
      return NextResponse.json({ success: false, error: 'This coupon has just reached its usage limit. Please try again without it.' }, { status: 400 });
    }
    if (batchLimitExceeded) {
      return NextResponse.json({ success: false, error: 'One of the desserts in your order has just reached today\'s batch limit. Please reduce the quantity or choose another dessert.' }, { status: 400 });
    }
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
