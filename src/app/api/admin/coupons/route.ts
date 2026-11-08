import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getAllCoupons, createCoupon, toggleCouponStatus, deleteCoupon } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-coupons:${ip}`, 120, 60 * 1000);
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

    const coupons = await getAllCoupons();
    return NextResponse.json({ success: true, coupons });
  } catch (error: any) {
    console.error('Admin coupons error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-coupons:${ip}`, 120, 60 * 1000);
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

    const body = await request.json();
    const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, expiresAt } = body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { success: false, error: 'Coupon code is required.' },
        { status: 400 }
      );
    }
    if (!/^[A-Z0-9_-]+$/i.test(code.trim())) {
      return NextResponse.json(
        { success: false, error: 'Coupon code may only use letters, numbers, hyphens and underscores.' },
        { status: 400 }
      );
    }
    if (discountType !== 'fixed' && discountType !== 'percentage') {
      return NextResponse.json(
        { success: false, error: 'Discount type must be fixed or percentage.' },
        { status: 400 }
      );
    }
    // A bad value here reaches every customer: a negative fixed discount
    // would charge MORE than the order total, and a percentage over 100
    // makes no sense. Reject them at creation, not at checkout.
    const value = Number(discountValue);
    if (!Number.isInteger(value) || value <= 0) {
      return NextResponse.json(
        { success: false, error: 'Discount value must be a whole number above zero.' },
        { status: 400 }
      );
    }
    if (discountType === 'percentage' && value > 100) {
      return NextResponse.json(
        { success: false, error: 'Percentage discount cannot be more than 100.' },
        { status: 400 }
      );
    }
    const minOrder = minOrderAmount === undefined || minOrderAmount === null || minOrderAmount === '' ? 0 : Number(minOrderAmount);
    if (!Number.isInteger(minOrder) || minOrder < 0) {
      return NextResponse.json(
        { success: false, error: 'Minimum order amount must be zero or more.' },
        { status: 400 }
      );
    }
    const maxDiscount = maxDiscountAmount === undefined || maxDiscountAmount === null || maxDiscountAmount === '' ? null : Number(maxDiscountAmount);
    if (maxDiscount !== null && (!Number.isInteger(maxDiscount) || maxDiscount < 0)) {
      return NextResponse.json(
        { success: false, error: 'Maximum discount must be zero or more.' },
        { status: 400 }
      );
    }
    const limit = usageLimit === undefined || usageLimit === null || usageLimit === '' ? null : Number(usageLimit);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      return NextResponse.json(
        { success: false, error: 'Usage limit must be at least 1.' },
        { status: 400 }
      );
    }
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
      return NextResponse.json(
        { success: false, error: 'Expiry date is not a valid date.' },
        { status: 400 }
      );
    }

    let couponId: number;
    try {
      couponId = await createCoupon({
        code,
        discountType,
        discountValue: value,
        minOrderAmount: minOrder,
        maxDiscountAmount: maxDiscount,
        usageLimit: limit,
        expiresAt: expiresAt || null,
      });
    } catch (err: any) {
      if (String(err?.message || '').includes('UNIQUE constraint failed')) {
        return NextResponse.json(
          { success: false, error: 'A coupon with this code already exists.' },
          { status: 400 }
        );
      }
      throw err;
    }

    return NextResponse.json({ success: true, couponId });
  } catch (error: any) {
    console.error('Admin coupons error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-coupons:${ip}`, 120, 60 * 1000);
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

    const body = await request.json();
    const { id, active } = body;

    if (!id || active === undefined) {
      return NextResponse.json({ success: false, error: 'Coupon ID and active state are required.' }, { status: 400 });
    }

    await toggleCouponStatus(id, active ? 1 : 0);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin coupons error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`admin-coupons:${ip}`, 120, 60 * 1000);
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Coupon ID required' }, { status: 400 });
    }

    await deleteCoupon(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin coupons error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
