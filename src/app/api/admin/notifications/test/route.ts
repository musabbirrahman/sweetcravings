import { NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth';
import { notifyKitchenNewOrder } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const testPayload = {
      order: {
        public_code: 'SC-TEST-999',
        customer_name: 'Test Customer (Sister Kitchen Test)',
        customer_phone: '01712345678',
        area_landmark: 'Kazihata, Rajshahi',
        delivery_address: 'House 12, Road 4',
        delivery_instructions: 'Kitchen notification test alert',
        payment_method: 'bkash',
        total_amount: 850,
        subtotal: 800,
        delivery_fee: 50,
        discount_amount: 0,
      },
      items: [
        {
          nameEn: 'Caramel Custard Flan',
          nameBn: 'ক্যারামেল কাস্টার্ড ফ্ল্যান',
          variantLabelEn: 'Standard (500g)',
          quantity: 1,
          unitPrice: 450,
          lineTotal: 450,
        },
        {
          nameEn: 'Royal Chocolate Fudge Cake',
          nameBn: 'রয়েল চকোলেট ফাজ কেক',
          variantLabelEn: 'Medium (500g)',
          quantity: 1,
          unitPrice: 400,
          lineTotal: 400,
        },
      ],
    };

    const result = await notifyKitchenNewOrder(testPayload);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'No notification channels responded. Please check your Telegram Bot Token & Chat ID or SMS settings.',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Test alert sent successfully via: ${result.methods.join(', ')}!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
