/**
 * Shared fetch for admin-panel data.
 *
 * Two rules every admin list follows:
 * 1. `cache: 'no-store'` — an admin list must never be served stale. A
 *    plain fetch() can be answered from the browser HTTP cache, so a new
 *    order would not appear until the cache expired.
 * 2. A 401 means the operator session is gone (expired, or the cookie was
 *    lost). The caller must send the operator back to /admin/login instead
 *    of rendering an empty list that still looks logged-in.
 */
export async function fetchAdminJson(path: string): Promise<{ status: number; data: any }> {
  const res = await fetch(path, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
