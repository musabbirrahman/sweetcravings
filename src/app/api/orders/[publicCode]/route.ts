import { NextResponse } from 'next/server';
import { getOrderWithDetails, getDb, getShopSettings, normalizePhone, getCouponByCode, reserveCouponUse, releaseCouponUse, isRetryableTxError, batchErrorIndex, countSoldToday, getCustomerLoyalty, findTrxIdConflict, normalizeSenderNumber, countPlacedOrdersToday, getDailyOrderLimit, type BatchStatement, type DbHandle } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { notifyKitchenNewOrder } from '@/lib/notifications';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';

// A TrxID already used on another order: the submission is refused
// outright, so the customer can correct it on the spot. The other
// order's code is never revealed to the customer — the message stays
// generic. Clients match on `code` to show a Bangla version.
const DUPLICATE_TRXID_MESSAGE = 'This TrxID has already been used. Please check the TrxID and try again.';

// A TrxID must come with the number the customer paid FROM, so the
// admin can verify the payment in the wallet app. Clients match on
// `code` to show a Bangla version.
const SENDER_NUMBER_MESSAGE = 'Please enter the 11-digit bKash/Nagad number you paid from (starts with 01).';

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
    // Never surface a raw database error to the customer.
    return NextResponse.json({ success: false, error: 'Something went wrong while loading your order. Please try again.', code: 'LOAD_FAILED' }, { status: 500 });
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
    const { trxId, senderNumber, provider, phone } = body;

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

    // The sender number is required together with the TrxID, on
    // re-submit and on draft conversion alike. Missing or invalid →
    // 400, nothing changed (the draft stays a draft).
    const sender = normalizeSenderNumber(senderNumber);
    if (!sender) {
      return NextResponse.json(
        { success: false, error: SENDER_NUMBER_MESSAGE, code: 'INVALID_SENDER_NUMBER' },
        { status: 400 }
      );
    }

    // Phone verification is mandatory before a TrxID can be attached.
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const db = await getDb();
    const order = await db.prepare('SELECT * FROM orders WHERE public_code = ?').get(params.publicCode) as any | null;

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
    const isDraft = order.order_status === 'draft';

    // ---- Draft conversion: a saved order becomes a real order. ----
    // The batch limit and the coupon use are enforced HERE, not when the
    // draft was saved (drafts reserve no stock and consume no coupon).
    // Any failure leaves the draft exactly as it is.
    if (isDraft) {
      // Daily per-phone order cap, tiered by trust (see
      // getDailyOrderLimit in src/lib/db.ts): a draft saved yesterday
      // and converted today counts toward today. On hit the draft stays
      // a draft and the customer gets the WhatsApp alternative in the UI.
      const dailyLimit = await getDailyOrderLimit(db, order.customer_phone);
      const placedToday = await countPlacedOrdersToday(db, order.customer_phone);
      if (placedToday >= dailyLimit) {
        return NextResponse.json({ success: false, error: `You have reached today's limit of ${dailyLimit} online orders for this phone number. Message us on WhatsApp and we will take your order manually.`, code: 'ORDER_LIMIT_REACHED' }, { status: 400 });
      }

      const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];

      // Batch limit, checked now (and re-checked inside the transaction):
      // the dessert may have sold out while the draft was waiting.
      // Takes the handle to use: the outer `db` for the pre-check, the
      // transaction handle `tx` for the re-check inside the transaction.
      const checkBatch = async (h: DbHandle): Promise<string | null> => {
        for (const item of items) {
          const limitRow = await h.prepare('SELECT daily_batch_limit FROM products WHERE id = ?').get(item.product_id) as { daily_batch_limit: number | null } | undefined;
          const limit = Number(limitRow?.daily_batch_limit ?? 15);
          const sold = await countSoldToday(h, item.product_id);
          if (sold + Number(item.quantity) > limit) {
            return item.product_name_en || 'One of the desserts in this order';
          }
        }
        return null;
      };
      const soldOutName = await checkBatch(db);
      if (soldOutName) {
        return NextResponse.json(
          { success: false, error: `${soldOutName} has reached today's batch limit. Your saved order is still saved — please try again tomorrow or contact the shop.` },
          { status: 400 }
        );
      }

      // The coupon is re-validated now: it may have expired or run out
      // of uses while the draft was waiting. The stored discount is
      // kept as-is (it is the price the customer already paid against).
      if (order.coupon_code) {
        const couponError = await validateCouponForConversion(order.coupon_code, order.subtotal, order.customer_phone);
        if (couponError) {
          return NextResponse.json({ success: false, error: couponError }, { status: 400 });
        }
      }

      // The duplicate check runs immediately before the batch, and the
      // batch itself is guarded by the partial unique index on
      // payment_submissions (see initSchema in src/lib/db.ts), so two
      // simultaneous converts of the same TrxID cannot both land: the
      // second batch fails with a UNIQUE-constraint error on the
      // submission statement and is mapped to DUPLICATE_TRXID below.
      const conflict = await findTrxIdConflict(db, trxId.trim(), order.id);
      if (conflict) {
        return NextResponse.json(
          { success: false, error: DUPLICATE_TRXID_MESSAGE, code: 'DUPLICATE_TRXID' },
          { status: 400 }
        );
      }

      // Reserve the coupon use before the batch; released if the batch
      // fails, so a failed conversion never consumes a coupon use.
      let couponReserved = false;
      if (order.coupon_code) {
        if (!await reserveCouponUse(db, order.coupon_code)) {
          return NextResponse.json(
            { success: false, error: 'The coupon on this saved order has just reached its usage limit. Your saved order is still saved — please contact the shop.' },
            { status: 400 }
          );
        }
        couponReserved = true;
      }

      // ONE batch, ONE round trip. The previous code held an interactive
      // Turso transaction open across ~7 sequential statements (each its
      // own HTTPS round trip from the Worker), and Turso rolled it back
      // with "SQLITE_BUSY: ... rolled back because the stream was idle
      // for too long" — the raw error the customer saw as a toast, and
      // the TrxID was never saved. A batch pipelines BEGIN + every write
      // + COMMIT into a single request, so there is no idle stream to
      // roll back. The batch-limit re-check that used to run inside the
      // transaction is gone with it: the checkBatch(db) pre-check above
      // is the guard now (two drafts converting at once could oversell
      // the last units by one — accepted, documented trade-off).
      const conversionStatements: BatchStatement[] = [
        {
          sql: `INSERT INTO payment_submissions (order_id, provider, transaction_ref, sender_number, claimed_amount, submitted_at, review_state)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [order.id, prov, trxId.trim(), sender, order.total_amount, now, 'pending'],
        },
        {
          sql: `UPDATE orders
            SET payment_status = 'submitted', order_status = 'new', updated_at = ?
            WHERE id = ?`,
          args: [now, order.id],
        },
        {
          sql: `INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
          args: [order.id, 'payment_update', 'submitted', 'customer', `Customer submitted TrxID: ${trxId.trim()} (${prov})`, now],
        },
        {
          sql: `INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
          args: [order.id, 'draft', 'new', 'customer', 'Saved order submitted with TrxID', now],
        },
      ];
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await db.batch(conversionStatements);
            break;
          } catch (batchErr) {
            const message = batchErr instanceof Error ? batchErr.message : String(batchErr);
            if (/UNIQUE constraint/i.test(message) && batchErrorIndex(batchErr) === 0) {
              if (couponReserved && order.coupon_code) await releaseCouponUse(db, order.coupon_code);
              return NextResponse.json(
                { success: false, error: DUPLICATE_TRXID_MESSAGE, code: 'DUPLICATE_TRXID' },
                { status: 400 }
              );
            }
            if (isRetryableTxError(batchErr) && attempt === 0) continue; // the batch committed nothing; retry it
            throw batchErr;
          }
        }
      } catch (batchErr) {
        if (couponReserved && order.coupon_code) await releaseCouponUse(db, order.coupon_code);
        console.error('Draft conversion batch failed:', batchErr);
        return NextResponse.json(
          { success: false, error: 'Something went wrong while saving your TrxID. Please try again.', code: 'SUBMIT_FAILED' },
          { status: 500 }
        );
      }


      // The draft just became a real order: alert the kitchen, exactly
      // as a fresh checkout does. A failed notification never fails the
      // conversion — the order is already submitted.
      const notificationPromise = notifyKitchenNewOrder({
        order: {
          public_code: order.public_code,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          area_landmark: order.area_landmark,
          delivery_address: order.delivery_address,
          delivery_instructions: order.delivery_instructions || undefined,
          is_gift: Boolean(order.is_gift),
          recipient_name: order.recipient_name || null,
          recipient_phone: order.recipient_phone || null,
          gift_message: order.gift_message || null,
          payment_method: order.payment_method,
          // The conversion submits the TrxID: the kitchen message shows
          // it with the number paid from, for verification. A later
          // TrxID re-submit sends no second message (no notify call on
          // the re-submit path).
          trx_id: trxId.trim(),
          sender_number: sender,
          total_amount: order.total_amount,
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee,
          discount_amount: order.discount_amount,
          coupon_code: order.coupon_code,
        },
        items: items.map((item: any) => ({
          productId: item.product_id,
          nameEn: item.product_name_en,
          nameBn: item.product_name_bn,
          variantLabelEn: item.variant_label_en || '',
          variantLabelBn: item.variant_label_bn || '',
          unitPrice: item.unit_price,
          quantity: item.quantity,
          lineTotal: item.line_total,
        })),
      })
        .then((result) => {
          if (result.success) {
            console.log(`Kitchen notification dispatched for converted draft ${order.public_code} via: ${result.methods.join(', ')}`);
          } else {
            console.warn(`Kitchen notification for converted draft ${order.public_code} sent via no channel (check Telegram/SMS settings).`);
          }
        })
        .catch((err) => console.error('Kitchen notification dispatch failed:', err));
      let notificationAttached = false;
      try {
        getCloudflareContext().ctx.waitUntil(notificationPromise);
        notificationAttached = true;
      } catch {
        // Not running on Cloudflare Workers (local dev / plain Node).
      }
      if (!notificationAttached) {
        await Promise.race([
          notificationPromise,
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]);
      }

      return NextResponse.json({
        success: true,
        message: 'Transaction ID submitted successfully. Your order is now placed!',
        converted: true,
        orderStatus: 'new',
        paymentStatus: 'submitted',
      });
    }

    // A re-submitted TrxID supersedes the earlier (wrong) one: mark any
    // still-pending submission for this order as rejected, so only the
    // latest TrxID waits for review. (A converted draft has no earlier
    // submission, so this is a no-op there.)
    // The whole re-submit runs in one transaction: the duplicate check
    // and the supersede + insert cannot interleave with another submit
    // of the same TrxID, so two orders can never both accept it.
    // The duplicate check runs immediately before the batch, and the
    // batch is guarded by the partial unique index (see the conversion
    // branch above for why this is a batch, not an interactive tx: the
    // old transaction held a Turso stream open across ~6 sequential
    // statements and was rolled back for idleness). The batch rejects
    // the old pending submission before inserting the new one, so a
    // corrected re-submit of the same TrxID for this order still works.
    const conflict = await findTrxIdConflict(db, trxId.trim(), order.id);
    if (conflict) {
      return NextResponse.json(
        { success: false, error: DUPLICATE_TRXID_MESSAGE, code: 'DUPLICATE_TRXID' },
        { status: 400 }
      );
    }

    const resubmitStatements: BatchStatement[] = [
      {
        sql: `UPDATE payment_submissions
          SET review_state = 'rejected'
          WHERE order_id = ? AND review_state = 'pending'`,
        args: [order.id],
      },
      {
        sql: `INSERT INTO payment_submissions (order_id, provider, transaction_ref, sender_number, claimed_amount, submitted_at, review_state)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [order.id, prov, trxId.trim(), sender, order.total_amount, now, 'pending'],
      },
      {
        sql: `UPDATE orders
          SET payment_status = 'submitted', updated_at = ?
          WHERE id = ?`,
        args: [now, order.id],
      },
      {
        sql: `INSERT INTO order_status_events (order_id, from_status, to_status, acting_admin, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [order.id, 'payment_update', 'submitted', 'customer', `Customer submitted TrxID: ${trxId.trim()} (${prov})`, now],
      },
    ];
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await db.batch(resubmitStatements);
          break;
        } catch (batchErr) {
          const message = batchErr instanceof Error ? batchErr.message : String(batchErr);
          // The submission is statement 1: a UNIQUE failure there means
          // the TrxID is already live on another order.
          if (/UNIQUE constraint/i.test(message) && batchErrorIndex(batchErr) === 1) {
            return NextResponse.json(
              { success: false, error: DUPLICATE_TRXID_MESSAGE, code: 'DUPLICATE_TRXID' },
              { status: 400 }
            );
          }
          if (isRetryableTxError(batchErr) && attempt === 0) continue; // the batch committed nothing; retry it
          throw batchErr;
        }
      }
    } catch (batchErr) {
      console.error('TrxID re-submit batch failed:', batchErr);
      return NextResponse.json(
        { success: false, error: 'Something went wrong while saving your TrxID. Please try again.', code: 'SUBMIT_FAILED' },
        { status: 500 }
      );
    }


    return NextResponse.json({
      success: true,
      message: 'Transaction ID submitted successfully.',
    });
  } catch (error: any) {
    console.error('Error updating transaction ID:', error);
    // Never surface a raw database error to the customer.
    return NextResponse.json({ success: false, error: 'Something went wrong while saving your TrxID. Please try again.', code: 'SUBMIT_FAILED' }, { status: 500 });
  }
}

// Re-validate a draft's coupon at conversion time, mirroring the
// checkout checks. Returns an error message, or null when the coupon
// is still usable. The stored discount is kept as-is.
async function validateCouponForConversion(code: string, subtotal: number, phone: string): Promise<string | null> {
  const coupon = await getCouponByCode(code.trim());
  if (!coupon) return 'The coupon on this saved order is no longer recognised. Your saved order is still saved — please contact the shop.';
  if (!coupon.active) return 'The coupon on this saved order is no longer active. Your saved order is still saved — please contact the shop.';
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return 'The coupon on this saved order has expired. Your saved order is still saved — please contact the shop.';
  if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) return 'The coupon on this saved order has reached its maximum usage limit. Your saved order is still saved — please contact the shop.';
  if (subtotal < coupon.min_order_amount) return `This saved order no longer meets the coupon minimum of ৳${coupon.min_order_amount}. Your saved order is still saved — please contact the shop.`;
  if (coupon.code === 'SWEETREWARD') {
    const loyalty = await getCustomerLoyalty(phone);
    if (loyalty.rewardsAvailable <= 0) {
      return `The Sweet Reward on this saved order is no longer available (it unlocks after ${loyalty.stampsNeeded} completed orders, and each reward can be used only once). Your saved order is still saved — please contact the shop.`;
    }
  }
  return null;
}
