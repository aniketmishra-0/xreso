import { createClient, Client } from "@libsql/client/web";

let _client: Client | null = null;

/**
 * Returns a Turso (libSQL) client connected to the production database.
 *
 * Compatible with both local dev and Vercel serverless.
 * Replaces the old better-sqlite3 driver which failed on Vercel
 * because it required native bindings + a local .db file.
 */
export function getDb(): Client {
  if (_client) return _client;

  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  _client = createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return _client;
}
