import { NextResponse } from 'next/server';
import { getAllCoupons, createCoupon, toggleCouponStatus, deleteCoupon } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const coupons = getAllCoupons();
    return NextResponse.json({ success: true, coupons });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const body = await request.json();
    const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, expiresAt } = body;

    if (!code || !discountType || discountValue === undefined) {
      return NextResponse.json(
        { success: false, error: 'Code, discount type, and discount value are required.' },
        { status: 400 }
      );
    }

    const couponId = createCoupon({
      code,
      discountType,
      discountValue: parseInt(discountValue, 10),
      minOrderAmount: minOrderAmount ? parseInt(minOrderAmount, 10) : 0,
      maxDiscountAmount: maxDiscountAmount ? parseInt(maxDiscountAmount, 10) : null,
      usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json({ success: true, couponId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const body = await request.json();
    const { id, active } = body;

    if (!id || active === undefined) {
      return NextResponse.json({ success: false, error: 'Coupon ID and active state are required.' }, { status: 400 });
    }

    toggleCouponStatus(id, active ? 1 : 0);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Coupon ID required' }, { status: 400 });
    }

    deleteCoupon(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
