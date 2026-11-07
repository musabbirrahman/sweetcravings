import { NextResponse } from 'next/server';
import { getCouponByCode } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, subtotal = 0 } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Please enter a coupon code.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = getCouponByCode(cleanCode);

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
    return NextResponse.json({ success: false, valid: false, error: error.message }, { status: 500 });
  }
}
