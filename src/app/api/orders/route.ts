import { NextResponse } from 'next/server';
import { 
  getDb, 
  generateUniquePublicOrderCode, 
  getShopSettings, 
  getAllOrders, 
  getCouponByCode, 
  getCustomerLoyalty,
  incrementCouponUsage,
  countSoldToday,
  findTrxIdConflict,
  normalizeSenderNumber,
  runInTransaction
} from '@/lib/db';
import { Product, ProductVariant } from '@/lib/types';
import { verifyAdminSession } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { notifyKitchenNewOrder } from '@/lib/notifications';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';

const ALLOWED_PAYMENT_METHODS = ['cod', 'bkash', 'nagad'] as const;

// A TrxID already used on another order: the submission is refused
// outright, so the customer can correct it on the spot. The other
// order's code is never revealed to the customer — the message stays
// generic. Clients match on `code` to show a Bangla version.
const DUPLICATE_TRXID_MESSAGE = 'This TrxID has already been used. Please check the TrxID and try again.';

// A TrxID must come with the number the customer paid FROM, so the
// admin can verify the payment in the wallet app. Clients match on
// `code` to show a Bangla version.
const SENDER_NUMBER_MESSAGE = 'Please enter the 11-digit bKash/Nagad number you paid from (starts with 01).';

export async function POST(request: Request) {
  // Set inside the order transaction when a coupon's last use is taken by
  // another order first; the catch below turns it into a clear 400.
  let couponExhausted = false;
  // Same pattern for the daily batch limit (see the in-transaction check).
  let batchLimitExceeded = false;
  // Same pattern for a TrxID already used on another order: the
  // in-transaction duplicate check sets this, then throws.
  let duplicateTrxId = false;
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
      senderNumber,
      idempotencyToken,
      couponCode,
      isGift,
      recipientName,
      recipientPhone,
      giftMessage,
      saveAsDraft,
    } = body;
    const requestedTime = body.requestedTime || body.requestedDeliveryTime || null;

    // Check store paused status
    const settings = await getShopSettings();
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

    // "Save and pay later" is only for wallet payments: the customer
    // pays in the bKash/Nagad app and finishes the order with the TrxID
    // afterwards. A COD order has nothing to pay later, so it cannot be
    // saved as a draft.
    if (saveAsDraft === true && paymentMethod === 'cod') {
      return NextResponse.json({ success: false, error: 'Save and pay later is only for bKash or Nagad payments. Cash on Delivery orders are placed directly.' }, { status: 400 });
    }
    // A draft is a saved, NOT submitted order: it reserves no stock,
    // consumes no coupon use, creates no payment submission and does not
    // alert the kitchen. It becomes a real order only when the customer
    // submits the TrxID (track page / order page), which runs the
    // batch-limit and coupon checks at that point.
    const isDraft = saveAsDraft === true;

    // bKash/Nagad orders must carry the TrxID at checkout: the customer
    // pays first, then enters the TrxID they received. A wallet order
    // without one must never be created. This check runs before any
    // database write, so a rejected request creates no order, no items,
    // no coupon use and no submission row. COD needs no TrxID. The
    // track page stays as the correction path for a mistyped TrxID.
    // Drafts skip this check: they carry no TrxID by design.
    if (!isDraft && (paymentMethod === 'bkash' || paymentMethod === 'nagad')) {
      const methodName = paymentMethod === 'bkash' ? 'bKash' : 'Nagad';
      if (!trxId || typeof trxId !== 'string' || !trxId.trim()) {
        return NextResponse.json({ success: false, error: `Please send the payment via ${methodName} first, then enter the Transaction ID (TrxID). Your order cannot be placed without it.` }, { status: 400 });
      }
      if (trxId.trim().length > 50) {
        return NextResponse.json({ success: false, error: 'Transaction ID is too long (maximum 50 characters).' }, { status: 400 });
      }
      // The sender number is required together with the TrxID: the
      // admin checks the wallet app for a transaction FROM this number,
      // for this amount, with this TrxID. Missing or invalid → 400,
      // nothing created. Drafts skip this: they carry no TrxID yet.
      if (!normalizeSenderNumber(senderNumber)) {
        return NextResponse.json({ success: false, error: SENDER_NUMBER_MESSAGE, code: 'INVALID_SENDER_NUMBER' }, { status: 400 });
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

    const db = await getDb();

    // Idempotency check: prevent duplicate submits
    if (idempotencyToken) {
      const existing = await db.prepare('SELECT public_code, subtotal, delivery_fee, total_amount, discount_amount, coupon_code FROM orders WHERE idempotency_token = ?').get(idempotencyToken) as any;
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

    const prodStmt = await db.prepare('SELECT * FROM products WHERE id = ?');
    const varStmt = await db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?');

    for (const item of items) {
      // Impose a safe maximum of 50 units per line item
      const qty = Math.min(50, Math.max(1, parseInt(item.quantity || 1, 10)));
      const product = await prodStmt.get(item.productId) as unknown as Product | null;
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
      // batch that sold out cannot be ordered by any route. Drafts skip
      // this check: they reserve no stock, and the limit is enforced
      // when the draft is converted with the TrxID instead.
      const dailyLimit = Number(product.daily_batch_limit ?? 15);
      const soldToday = await countSoldToday(db, product.id);
      if (!isDraft && soldToday + qty > dailyLimit) {
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
        const variant = await varStmt.get(item.variantId, product.id) as unknown as ProductVariant | null;
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
      const coupon = await getCouponByCode(couponCode.trim());
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
      // loyalty_orders_per_reward completed orders (admin setting,
      // default 5), and each earned reward can be used only once.
      if (coupon.code === 'SWEETREWARD') {
        const loyalty = await getCustomerLoyalty(cleanPhone);
        if (loyalty.rewardsAvailable <= 0) {
          return NextResponse.json({ success: false, error: `The Sweet Reward unlocks after ${loyalty.stampsNeeded} completed orders, and each reward can be used only once.` }, { status: 400 });
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

    const initialPaymentStatus = !isDraft && (paymentMethod === 'bkash' || paymentMethod === 'nagad') && trxId && String(trxId).trim()
      ? 'submitted'
      : 'pending';

    // ATOMIC TRANSACTION: Insert order, items, status event, and payment submission together.
    // Retries with a fresh public code if the (very unlikely) random code
    // collides with an existing order; any other failure aborts at once.
    let orderId: number = 0;
    let publicCode = '';
    let lastTxError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      publicCode = await generateUniquePublicOrderCode(db);

      try {
        // One transaction: the order, its items, the status event, the
        // payment record and the coupon reservation all land together
        // or not at all. runInTransaction (src/lib/db.ts) commits on
        // success and rolls back on throw, on either database driver.
        // NOTE: use the `tx` handle inside, not the outer `db` — on the
        // Turso driver the statements only run inside the transaction
        // on `tx`; the outer handle would run them outside it.
        await runInTransaction(db, async (tx) => {
        // A TrxID is proof of one payment: refuse it here, before the
        // order is inserted, when another order already carries it
        // (trimmed, case-insensitive, any review state). Throwing
        // rolls the whole transaction back, so a rejected request
        // creates no order, no items, no coupon use and no submission.
        // Drafts never reach this: they carry no TrxID.
        if (!isDraft && trxId && String(trxId).trim() && (paymentMethod === 'bkash' || paymentMethod === 'nagad')) {
          const conflict = await findTrxIdConflict(tx, String(trxId).trim());
          if (conflict) {
            duplicateTrxId = true;
            throw new Error('DUPLICATE_TRXID');
          }
        }

        const insertOrder = await tx.prepare(`
          INSERT INTO orders (
            public_code, customer_name, customer_phone, delivery_address, area_landmark,
            delivery_instructions, requested_time, is_gift, recipient_name, recipient_phone, gift_message,
            payment_method, payment_status, order_status,
            subtotal, delivery_fee, discount_amount, coupon_code, total_amount, idempotency_token, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = await insertOrder.run(
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
          isDraft ? 'draft' : 'new',
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
        // the whole order instead of overselling the batch. Drafts skip
        // this: they reserve no stock (checked at conversion instead).
        for (const vItem of validatedItems) {
          const limitRow = await tx.prepare('SELECT daily_batch_limit FROM products WHERE id = ?').get(vItem.productId) as { daily_batch_limit: number | null } | undefined;
          const limit = Number(limitRow?.daily_batch_limit ?? 15);
          if (!isDraft && await countSoldToday(tx, vItem.productId) + vItem.quantity > limit) {
            batchLimitExceeded = true;
            throw new Error('BATCH_LIMIT_EXCEEDED');
          }
        }

        // Insert order items
        const insertItem = await tx.prepare(`
          INSERT INTO order_items (
            order_id, product_id, product_name_en, product_name_bn,
            variant_label_en, variant_label_bn, unit_price, quantity, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const vItem of validatedItems) {
          await insertItem.run(
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
        await tx.prepare(`
          INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(orderId, 'none', 'new', 'customer', 'Order placed through website', now);

        // Insert payment submission if TrxID provided. Drafts never
        // carry a submission: the TrxID arrives at conversion.
        if (!isDraft && trxId && String(trxId).trim() && (paymentMethod === 'bkash' || paymentMethod === 'nagad')) {
          await tx.prepare(`
            INSERT INTO payment_submissions (order_id, provider, transaction_ref, sender_number, claimed_amount, submitted_at, review_state)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(orderId, paymentMethod, String(trxId).trim().slice(0, 50), normalizeSenderNumber(senderNumber), totalAmount, now, 'pending');
        }

        // Reserve one coupon use atomically. If another order just took
        // the last use, abort this order instead of charging full price
        // while the customer believed a discount applied. Drafts do not
        // consume a use: the coupon is reserved at conversion instead.
        if (!isDraft && appliedCouponCode) {
          if (!await incrementCouponUsage(appliedCouponCode)) {
            couponExhausted = true;
            throw new Error('COUPON_EXHAUSTED');
          }
        }

        });
        lastTxError = null;
        break;
      } catch (txErr) {
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

    // Kitchen notification — attached to the Worker's lifetime so it
    // actually runs. The old code fired notifyKitchenNewOrder() without
    // awaiting it and returned the response immediately; on Cloudflare
    // Workers the runtime may freeze/suspend the Worker once the response
    // is sent, so the in-flight Telegram fetch often never completed
    // (the test endpoint awaits it, which is why the test alert worked
    // and real orders did not). waitUntil keeps checkout fast AND lets
    // the notification finish. Outside Workers (local `next start`) the
    // Cloudflare context does not exist, so fall back to awaiting the
    // dispatch with a timeout — a slow Telegram must never hang checkout.
    // Drafts do not alert the kitchen: they are not orders yet. The
    // kitchen is notified when the draft is converted with the TrxID.
    if (!isDraft) {
    const notificationPromise = notifyKitchenNewOrder({
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
        // Wallet orders carry the TrxID + the number paid from, so the
        // kitchen message shows them for verification. Drafts never
        // reach this call (see the `if (!isDraft)` guard above).
        trx_id: !isDraft && trxId ? String(trxId).trim().slice(0, 50) : null,
        sender_number: !isDraft ? normalizeSenderNumber(senderNumber) : null,
        total_amount: totalAmount,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        coupon_code: appliedCouponCode,
      },
      items: validatedItems,
    })
      .then((result) => {
        if (result.success) {
          console.log(`Kitchen notification dispatched for order ${publicCode} via: ${result.methods.join(', ')}`);
        } else {
          console.warn(`Kitchen notification for order ${publicCode} sent via no channel (check Telegram/SMS settings).`);
        }
      })
      .catch((err) => console.error('Kitchen notification dispatch failed:', err));
    let notificationAttached = false;
    try {
      getCloudflareContext().ctx.waitUntil(notificationPromise);
      notificationAttached = true;
    } catch {
      // Not running on Cloudflare Workers (local dev / plain Node) —
      // fall through to the await-with-timeout below.
    }
    if (!notificationAttached) {
      await Promise.race([
        notificationPromise,
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    }
    }

    return NextResponse.json({
      success: true,
      orderId,
      publicCode,
      subtotal,
      deliveryFee,
      discountAmount,
      couponCode: appliedCouponCode,
      totalAmount,
      isDraft,
    });
  } catch (error: any) {
    console.error('Error placing order:', error);
    if (duplicateTrxId) {
      return NextResponse.json({ success: false, error: DUPLICATE_TRXID_MESSAGE, code: 'DUPLICATE_TRXID' }, { status: 400 });
    }
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
// no-store on every response: this list must always be fresh — a cached
// copy would hide new orders from the admin panel.
export async function GET(request: Request) {
  try {
    const isAuthed = verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Operator session required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status') || undefined;

    const orders = await getAllOrders(filterStatus);
    return NextResponse.json(
      {
        success: true,
        orders,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
