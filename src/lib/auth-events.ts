import { createClient, type Client } from "@libsql/client/web";

type AuthEventInput = {
  eventType: "register" | "login" | "oauth_login" | "password_reset_request" | "password_reset_confirm";
  userId?: string | null;
  email?: string | null;
  provider?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getTursoClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function ensureAuthEventsTable(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS auth_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id TEXT,
      email TEXT,
      provider TEXT,
      ip_address TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON auth_events(user_id)"
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_auth_events_email ON auth_events(email)"
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_auth_events_type_created_at ON auth_events(event_type, created_at)"
  );
}

export async function logAuthEvent(input: AuthEventInput, client?: Client) {
  try {
    const dbClient = client ?? getTursoClient();
    await ensureAuthEventsTable(dbClient);

    await dbClient.execute({
      sql: `
        INSERT INTO auth_events (
          event_type,
          user_id,
          email,
          provider,
          ip_address,
          metadata
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        input.eventType,
        input.userId ?? null,
        input.email ?? null,
        input.provider ?? null,
        input.ipAddress ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    });
  } catch (error) {
    console.error("[auth-events] Failed to log auth event", {
      eventType: input.eventType,
      error,
    });
  }
}
