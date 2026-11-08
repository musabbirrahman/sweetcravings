import { NextResponse } from 'next/server';
import {
  getDb,
  generateUniquePublicOrderCode,
  getShopSettings,
  getAllOrders,
  getCouponByCode,
  getCustomerLoyalty,
  reserveCouponUse,
  releaseCouponUse,
  isRetryableTxError,
  batchErrorIndex,
  countSoldToday,
  findTrxIdConflict,
  normalizeSenderNumber,
  type BatchStatement
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

    // ATOMIC BATCH: the order, its items, the status event and the
    // payment submission land together or not at all — as ONE batch,
    // executed by the database in a single round trip.
    //
    // Why a batch, not an interactive transaction: the previous code
    // opened client.transaction('write') and ran ~10-12 statements
    // across it (prepare + run per statement, each its own HTTPS round
    // trip to Turso). Turso rolls an interactive transaction back when
    // its stream sits idle for too long (5-second window), so a slow
    // checkout failed with "SQLITE_BUSY: ... rolled back because the
    // stream was idle for too long" — the customer saw a raw database
    // error and no order was created. client.batch(..., 'write')
    // pipelines BEGIN + every statement + COMMIT into one HTTP request,
    // so there is no idle stream to roll back.
    //
    // Checks that need a read (duplicate TrxID, batch limit, coupon)
    // run BEFORE the batch, on the outer handle. The batch-limit and
    // coupon checks already ran above during pricing/validation; the
    // duplicate TrxID is re-checked here, immediately before the batch,
    // and the batch itself is guarded by a partial unique index on
    // payment_submissions (see initSchema in src/lib/db.ts), so two
    // simultaneous submits of the same TrxID cannot both land: the
    // second batch fails with a UNIQUE-constraint error on the
    // submission statement and is mapped to DUPLICATE_TRXID below.
    // (The old in-transaction batch-limit re-check is gone with the
    // transaction: the pre-check above is the guard now. Two checkouts
    // racing for the last units of one dessert could oversell by one —
    // accepted, documented trade-off; the daily limit is a soft cap,
    // and the pre-check still blocks every ordinary oversell.)
    const hasWalletTrx = !isDraft && trxId && String(trxId).trim() && (paymentMethod === 'bkash' || paymentMethod === 'nagad');
    if (hasWalletTrx) {
      const conflict = await findTrxIdConflict(db, String(trxId).trim());
      if (conflict) {
        return NextResponse.json({ success: false, error: DUPLICATE_TRXID_MESSAGE, code: 'DUPLICATE_TRXID' }, { status: 400 });
      }
    }

    // Reserve one coupon use first (guarded UPDATE: only moves when a
    // use is left). It is released again if the batch below fails, so a
    // failed order never consumes a coupon use. Drafts do not consume a
    // use: the coupon is reserved at conversion instead.
    let couponReserved = false;
    if (!isDraft && appliedCouponCode) {
      if (!await reserveCouponUse(db, appliedCouponCode)) {
        return NextResponse.json({ success: false, error: 'This coupon has just reached its usage limit. Please try again without it.' }, { status: 400 });
      }
      couponReserved = true;
    }

    let orderId = 0;
    let publicCode = '';
    let lastBatchError: unknown = null;
    let busyRetries = 0;
    // Retries with a fresh public code if the (very unlikely) random
    // code collides with an existing order; a batch that fails with
    // SQLITE_BUSY / an idle-rollback is retried ONCE (it committed
    // nothing). Any other failure aborts at once.
    for (let attempt = 0; attempt < 3; attempt++) {
      publicCode = await generateUniquePublicOrderCode(db);

      const statements: BatchStatement[] = [
        {
          sql: `INSERT INTO orders (
            public_code, customer_name, customer_phone, delivery_address, area_landmark,
            delivery_instructions, requested_time, is_gift, recipient_name, recipient_phone, gift_message,
            payment_method, payment_status, order_status,
            subtotal, delivery_fee, discount_amount, coupon_code, total_amount, idempotency_token, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
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
            now,
          ],
        },
        // Child rows reach the new order through its (unique) public
        // code instead of the insert's row id, which the batch only
        // reports after the whole batch has run.
        ...validatedItems.map((vItem) => ({
          sql: `INSERT INTO order_items (
            order_id, product_id, product_name_en, product_name_bn,
            variant_label_en, variant_label_bn, unit_price, quantity, line_total
          ) SELECT (SELECT id FROM orders WHERE public_code = ?), ?, ?, ?, ?, ?, ?, ?, ?`,
          args: [
            publicCode,
            vItem.productId,
            vItem.nameEn,
            vItem.nameBn,
            vItem.variantLabelEn,
            vItem.variantLabelBn,
            vItem.unitPrice,
            vItem.quantity,
            vItem.lineTotal,
          ],
        })),
        {
          sql: `INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
            SELECT (SELECT id FROM orders WHERE public_code = ?), 'none', 'new', 'customer', 'Order placed through website', ?`,
          args: [publicCode, now],
        },
        // A payment submission only for a real (non-draft) wallet order
        // with a TrxID. Drafts never carry a submission: the TrxID
        // arrives at conversion.
        ...(hasWalletTrx ? [{
          sql: `INSERT INTO payment_submissions (order_id, provider, transaction_ref, sender_number, claimed_amount, submitted_at, review_state)
            SELECT (SELECT id FROM orders WHERE public_code = ?), ?, ?, ?, ?, ?, 'pending'`,
          args: [
            publicCode,
            paymentMethod,
            String(trxId).trim().slice(0, 50),
            normalizeSenderNumber(senderNumber),
            totalAmount,
            now,
          ],
        }] : []),
      ];
      // The submission is the last statement when one exists: a UNIQUE
      // failure there means the TrxID is already live on another order.
      const submissionIndex = statements.length - 1;

      try {
        const results = await db.batch(statements);
        orderId = Number(results[0].lastInsertRowid);
        break;
      } catch (batchErr) {
        lastBatchError = batchErr;
        const message = batchErr instanceof Error ? batchErr.message : String(batchErr);
        const idx = batchErrorIndex(batchErr);
        const isUnique = /UNIQUE constraint/i.test(message);
        if (isUnique && idx === 0) {
          // Random public code collided with an existing order: fresh code, try again.
          continue;
        }
        if (hasWalletTrx && isUnique && idx === submissionIndex) {
          // The partial unique index on payment_submissions fired: this
          // TrxID is already live on another order (a simultaneous submit
          // passed the pre-check above). Nothing was created.
          if (couponReserved && appliedCouponCode) await releaseCouponUse(db, appliedCouponCode);
          return NextResponse.json({ success: false, error: DUPLICATE_TRXID_MESSAGE, code: 'DUPLICATE_TRXID' }, { status: 400 });
        }
        if (isRetryableTxError(batchErr) && busyRetries < 1) {
          busyRetries++;
          continue; // the batch committed nothing; retry it once
        }
        if (couponReserved && appliedCouponCode) await releaseCouponUse(db, appliedCouponCode);
        console.error('Error placing order (batch failed):', batchErr);
        return NextResponse.json({ success: false, error: 'Something went wrong while placing your order. Please try again.', code: 'ORDER_FAILED' }, { status: 500 });
      }
    }

    if (!orderId) {
      // Three attempts ended without an order (repeated public-code
      // collisions, or repeated SQLITE_BUSY): fail friendly rather than
      // looping forever. Nothing was created.
      if (couponReserved && appliedCouponCode) await releaseCouponUse(db, appliedCouponCode);
      console.error('Error placing order (batch failed after retries):', lastBatchError);
      return NextResponse.json({ success: false, error: 'Something went wrong while placing your order. Please try again.', code: 'ORDER_FAILED' }, { status: 500 });
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
    // Never surface a raw database error to the customer: a failed
    // checkout shows one friendly line, the detail stays in the log.
    return NextResponse.json({ success: false, error: 'Something went wrong while placing your order. Please try again.', code: 'ORDER_FAILED' }, { status: 500 });
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
