import { NextResponse } from 'next/server';
import { getCouponByCode, getCustomerLoyalty } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`coupon-validate:${ip}`, 20, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, valid: false, error: `Too many attempts. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { code, subtotal = 0, phone } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Please enter a coupon code.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await getCouponByCode(cleanCode);

    if (!coupon) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Invalid coupon code.' },
        { status: 404 }
      );
    }

    if (!coupon.active) {
      return NextResponse.json(
        { success: false, valid: false, error: 'This coupon is currently inactive.' },
        { status: 400 }
      );
    }

    // Check expiration
    if (coupon.expires_at) {
      const expiry = new Date(coupon.expires_at);
      if (expiry < new Date()) {
        return NextResponse.json(
          { success: false, valid: false, error: 'This coupon has expired.' },
          { status: 400 }
        );
      }
    }

    // Check usage limit
    if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
      return NextResponse.json(
        { success: false, valid: false, error: 'This coupon has reached its maximum usage limit.' },
        { status: 400 }
      );
    }

    // Check minimum order amount
    if (subtotal < coupon.min_order_amount) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: `Minimum order amount of ৳${coupon.min_order_amount} required to use this coupon.`
        },
        { status: 400 }
      );
    }

    // The loyalty reward is earned, not public. When the caller's phone
    // is known, check an unused reward actually exists for them. The
    // order endpoint re-checks this authoritatively at checkout.
    if (coupon.code === 'SWEETREWARD' && phone && typeof phone === 'string') {
      const loyalty = await getCustomerLoyalty(phone);
      if (loyalty.rewardsAvailable <= 0) {
        return NextResponse.json(
          { success: false, valid: false, error: `The Sweet Reward unlocks after ${loyalty.stampsNeeded} completed orders, and each reward can be used only once.` },
          { status: 400 }
        );
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discount_type === 'fixed') {
      discountAmount = Math.min(subtotal, coupon.discount_value);
    } else if (coupon.discount_type === 'percentage') {
      let rawDiscount = Math.round((subtotal * coupon.discount_value) / 100);
      if (coupon.max_discount_amount) {
        rawDiscount = Math.min(rawDiscount, coupon.max_discount_amount);
      }
      discountAmount = Math.min(subtotal, rawDiscount);
    }

    return NextResponse.json({
      success: true,
      valid: true,
      code: coupon.code,
      discountAmount,
      newTotal: Math.max(0, subtotal - discountAmount),
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      message: `Coupon applied: ৳${discountAmount} discount!`,
    });
  } catch (error: any) {
    console.error('Coupon validate error:', error);
    return NextResponse.json({ success: false, valid: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
