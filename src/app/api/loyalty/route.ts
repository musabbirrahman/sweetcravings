import { NextResponse } from 'next/server';
import { getCustomerLoyalty } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = checkRateLimit(`loyalty:${ip}`, 30, 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Please wait ${limit.retryAfterSeconds} seconds and try again.` },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    // Full 11-digit number only. A few digits must not reveal a
    // customer's name, order count or spending to anyone guessing.
    const digits = (phone || '').replace(/\D/g, '');
    const fullPhone = digits.length === 13 && digits.startsWith('88') ? digits.slice(2) : digits;
    if (!/^01[3-9]\d{8}$/.test(fullPhone)) {
      return NextResponse.json({
        success: false,
        error: 'Enter your full 11-digit Bangladesh mobile number (e.g. 01712345678).'
      }, { status: 400 });
    }

    const loyalty = await getCustomerLoyalty(fullPhone);

    // Public shape only: the stamp card renders stamps, tiers and the
    // reward — never the customer's name, order totals or spending.
    // Anyone holding a phone number could read those off this endpoint.
    const { stamps, stampsNeeded, stampsToNextReward, rewardsAvailable, tier, tierBn, rewardCouponCode, rewardAmount } = loyalty;
    return NextResponse.json({
      success: true,
      loyalty: { stamps, stampsNeeded, stampsToNextReward, rewardsAvailable, tier, tierBn, rewardCouponCode, rewardAmount }
    });
  } catch (error: any) {
    console.error('Error fetching loyalty stamps:', error);
    return NextResponse.json({
      success: false,
      error: 'Something went wrong. Please try again.'
    }, { status: 500 });
  }
}
