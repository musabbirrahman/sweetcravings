import { createClient, Client } from '@libsql/client';

let _tursoClient: Client | null = null;

export function getTursoClient(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    return null;
  }

  if (!_tursoClient) {
    _tursoClient = createClient({
      url,
      authToken,
    });
  }

  return _tursoClient;
}

export function isTursoEnabled(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}
