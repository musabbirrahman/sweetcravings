import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'sc_admin_token';
export const ADMIN_SESSION_VALUE = 'authenticated_operator';

/**
 * Validates whether the incoming request is from an authenticated admin operator.
 */
export function verifyAdminSession(request?: Request): boolean {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (token === ADMIN_SESSION_VALUE) {
      return true;
    }
  } catch {
    // cookies() might fail if called outside request context
  }

  if (request) {
    const cookieHeader = request.headers.get('cookie') || '';
    if (cookieHeader.includes(`${ADMIN_COOKIE_NAME}=${ADMIN_SESSION_VALUE}`)) {
      return true;
    }
  }

  return false;
}
