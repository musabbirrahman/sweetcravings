// Tiny in-memory rate limiter for public endpoints.
// NOTE: counts reset when the server restarts and are per-instance on
// serverless hosts. It is a spam brake, not a security boundary — the
// endpoints it guards must still verify identity on every request.
// Residual limit (not fixed here): on Cloudflare Workers the buckets
// and the admin lockout live in memory per isolate, so they may not
// hold across isolates. A durable store would need Workers KV —
// out of scope, do not build it here.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 2000) {
    buckets.forEach((entry, k) => {
      if (entry.resetAt <= now) buckets.delete(k);
    });
  }

  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(request: Request): string {
  // Cloudflare sets cf-connecting-ip to the real client IP, and a
  // client cannot spoof it through Cloudflare — so when it is present
  // it wins and X-Forwarded-For is ignored entirely. Without it
  // (local dev / direct access) take the LAST X-Forwarded-For entry:
  // the one added by the closest proxy. The FIRST entry is
  // client-controlled, and trusting it let anyone dodge the admin
  // lockout and the limiter by rotating the header per request.
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  const forwarded = request.headers.get('x-forwarded-for');
  const entries = forwarded?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  return entries[entries.length - 1] || 'unknown';
}
