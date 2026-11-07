import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminConfigured,
  verifyAdminPassword,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

// In-memory brute force protection: track attempts per IP
const attemptsMap = new Map<string, { count: number; lockedUntil: number }>();

export async function POST(request: Request) {
  try {
    // Fail closed: without a configured admin password there is no login.
    if (!isAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Admin login is not configured. Set ADMIN_PASSWORD on the server.' },
        { status: 503 }
      );
    }

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

    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';

    if (verifyAdminPassword(password)) {
      attemptsMap.delete(ip); // reset on success

      const token = createAdminSessionToken();
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Admin login is not configured. Set ADMIN_PASSWORD on the server.' },
          { status: 503 }
        );
      }

      const response = NextResponse.json({ success: true, message: 'Authentication successful' });
      response.cookies.set(ADMIN_COOKIE_NAME, token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 24 hours
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
      { success: false, error: 'Incorrect password' },
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
