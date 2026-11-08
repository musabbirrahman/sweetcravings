import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminConfigured,
  verifyAdminPassword,
} from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

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

    // IP for the brute-force lockout. getClientIp() prefers
    // cf-connecting-ip (unspoofable through Cloudflare) and otherwise
    // takes the LAST X-Forwarded-For entry — never the first, which is
    // client-controlled and used to rotate past the lockout.
    const ip = getClientIp(request);
    const authLimit = checkRateLimit(`admin-auth:${ip}`, 120, 60 * 1000);
    if (!authLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Please wait ${authLimit.retryAfterSeconds} seconds and try again.` },
        { status: 429 }
      );
    }
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
    console.error('Admin login error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Signed out' });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
