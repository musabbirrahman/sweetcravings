import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'sc_admin_token';

// Admin sessions last 24 hours. The token is an HMAC-signed, random,
// expiring value — never a static shared string.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || !secret.trim()) return null;
  return secret;
}

/** True when an admin password is configured. Login fails closed otherwise. */
export function isAdminConfigured(): boolean {
  return getAdminSecret() !== null;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

/** Create a signed session token. Returns null when no admin password is set. */
export function createAdminSessionToken(): string | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  const payload = JSON.stringify({
    r: randomBytes(16).toString('hex'),
    exp: Date.now() + SESSION_TTL_MS,
  });
  const payloadB64 = b64url(Buffer.from(payload, 'utf8'));
  const sig = createHmac('sha256', secret).update(`v1.${payloadB64}`).digest();
  return `v1.${payloadB64}.${b64url(sig)}`;
}

/** Verify a session token's signature and expiry. Never throws. */
export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = getAdminSecret();
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const [, payloadB64, sigB64] = parts;

  const expected = createHmac('sha256', secret).update(`v1.${payloadB64}`).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(sigB64, 'base64url');
  } catch {
    return false;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  let payload: { exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return false;
  return true;
}

/** Timing-safe comparison of a login attempt against the configured password. */
export function verifyAdminPassword(candidate: string | undefined | null): boolean {
  const secret = getAdminSecret();
  if (!secret || !candidate) return false;
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

/**
 * Validates whether the incoming request is from an authenticated admin operator.
 * Reads the signed session cookie; a missing/invalid/expired token is rejected.
 */
export function verifyAdminSession(request?: Request): boolean {
  let token: string | undefined;
  try {
    token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  } catch {
    // cookies() might fail if called outside request context
  }

  if (!token && request) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`));
    if (match) {
      try {
        token = decodeURIComponent(match.slice(ADMIN_COOKIE_NAME.length + 1));
      } catch {
        token = undefined;
      }
    }
  }

  return verifyAdminSessionToken(token);
}
