import { NextRequest, NextResponse } from 'next/server';

// Server-side guard for the operator area. The admin pages are client
// components with no server-side check of their own, so this middleware is
// the gate: without a valid signed session cookie, /admin/* redirects to
// the login page and /api/admin/* gets a 401. Login itself is exempt.
// Fails closed: when ADMIN_PASSWORD is not set, nothing gets in.

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

const ADMIN_COOKIE_NAME = 'sc_admin_token';

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const [, payloadB64, sigB64] = parts;

  let payload: { exp?: unknown };
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    return false;
  }
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(sigB64),
      new TextEncoder().encode(`v1.${payloadB64}`)
    );
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page and the login/logout API stay open.
  if (pathname === '/admin/login' || pathname === '/api/admin/auth') {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_PASSWORD;
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const ok = secret ? await verifySessionToken(token, secret) : false;

  if (!ok) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Operator session required.' },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
