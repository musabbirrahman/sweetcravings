import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// In-memory brute force protection: track attempts per IP
const attemptsMap = new Map<string, { count: number; lockedUntil: number }>();

export async function POST(request: Request) {
  try {
    // Basic IP identification for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'local_client';
    const now = Date.now();
    const clientRecord = attemptsMap.get(ip) || { count: 0, lockedUntil: 0 };

    if (clientRecord.lockedUntil > now) {
      const waitSeconds = Math.ceil((clientRecord.lockedUntil - now) / 1000);
      return NextResponse.json(
        { success: false, error: `Too many failed attempts. Please wait ${waitSeconds} seconds.` },
        { status: 429 }
      );
    }

    const { pin } = await request.json();

    // Accepted PINs: default operator PINs
    const validPins = ['1234', 'sweet2026', 'admin'];

    if (validPins.includes(pin)) {
      attemptsMap.delete(ip); // reset on success

      const response = NextResponse.json({ success: true, message: 'Authentication successful' });
      response.cookies.set(ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return response;
    }

    // Failed attempt tracking
    clientRecord.count += 1;
    if (clientRecord.count >= 5) {
      clientRecord.lockedUntil = now + 15 * 60 * 1000; // Lock for 15 minutes
      attemptsMap.set(ip, clientRecord);
      return NextResponse.json(
        { success: false, error: 'Too many incorrect attempts. Locked for 15 minutes.' },
        { status: 429 }
      );
    }

    attemptsMap.set(ip, clientRecord);
    return NextResponse.json(
      { success: false, error: 'Incorrect PIN' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Signed out' });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
