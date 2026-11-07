import { NextResponse } from 'next/server';
import { getCustomerLoyalty } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || phone.replace(/\D/g, '').length < 6) {
      return NextResponse.json({
        success: false,
        error: 'A valid phone number is required (at least 6 digits).'
      }, { status: 400 });
    }

    const loyalty = getCustomerLoyalty(phone);

    return NextResponse.json({
      success: true,
      loyalty
    });
  } catch (error: any) {
    console.error('Error fetching loyalty stamps:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
