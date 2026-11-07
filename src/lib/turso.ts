// Turso (libSQL) client factory.
//
// The app talks to Turso through the async `@libsql/client` (see
// src/lib/db.ts). That client runs on Cloudflare Workers — its `web`
// entry is a pure fetch client — which is why the native `libsql`
// package (used by the first Turso pass) is gone.
//
// Configuration (see .env.example):
// - TURSO_DATABASE_URL: the database URL, e.g. libsql://<name>-<org>.turso.io
//   for a remote database, or file:/absolute/path.db for a local file
//   (used by the tests to exercise the Turso code path without an
//   account). Empty (unset) means: use the local node:sqlite file.
// - TURSO_AUTH_TOKEN: the database auth token. Needed for a remote
//   database, not needed for a local `file:` URL.
//
// The client entry point is chosen by URL scheme, via dynamic import:
// - `file:` URLs need the Node client (`@libsql/client/node`) — the
//   web client cannot open local files.
// - Anything else (libsql://, https://) uses the web client
//   (`@libsql/client/web`), the pure-fetch client that runs on Workers.
//
// The two subpaths are imported dynamically (not through the package
// root) on purpose: Next.js's file tracer only copies files reachable
// from the `node` export conditions, so a plain `from '@libsql/client'`
// import leaves `lib-esm/web.js` out of the standalone output and the
// OpenNext build then fails to resolve it. The explicit subpaths make
// the tracer copy both entry points.
//
// No accounts are created here; the owner creates the Turso database
// and pastes these two values into the environment (see DEPLOY.md).
import type { Client } from '@libsql/client';

const TURSO_URL = (process.env.TURSO_DATABASE_URL || '').trim();
const TURSO_TOKEN = (process.env.TURSO_AUTH_TOKEN || '').trim();

/** True when the app should talk to Turso instead of the local file. */
export function isTursoConfigured(): boolean {
  return TURSO_URL.length > 0;
}

/**
 * Build the @libsql/client client, or null when no Turso URL is set
 * (the caller falls back to the local node:sqlite file). The auth token
 * is optional: a remote libsql:// database needs one, a local `file:`
 * URL does not.
 */
export async function getTursoClient(): Promise<Client | null> {
  if (!TURSO_URL) return null;
  if (TURSO_URL.startsWith('file:')) {
    const { createClient } = await import('@libsql/client/node');
    return createClient({ url: TURSO_URL });
  }
  const { createClient } = await import('@libsql/client/web');
  return createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN || undefined,
  });
}
