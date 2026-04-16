import crypto from "crypto";
import { Client } from "@libsql/client/web";

type PasswordResetRecord = {
  id: number;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
};

export async function ensurePasswordResetTable(client: Client) {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await client.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash)");
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createPasswordResetToken(client: Client, userId: string): Promise<string> {
  await ensurePasswordResetTable(client);

  const token = generateResetToken();
  const tokenHash = hashResetToken(token);

  await client.execute({
    sql: "DELETE FROM password_reset_tokens WHERE user_id = ?",
    args: [userId],
  });
  await client.execute({
    sql: `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', '+1 hour'))`,
    args: [userId, tokenHash],
  });

  return token;
}

export async function findActivePasswordResetToken(client: Client, token: string): Promise<PasswordResetRecord | undefined> {
  await ensurePasswordResetTable(client);

  const tokenHash = hashResetToken(token);
  const result = await client.execute({
    sql: `SELECT id, user_id, token_hash, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = ?
         AND used_at IS NULL
         AND expires_at > datetime('now')
       LIMIT 1`,
    args: [tokenHash],
  });

  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    token_hash: String(row.token_hash),
    expires_at: String(row.expires_at),
    used_at: row.used_at ? String(row.used_at) : null,
  };
}

export async function markPasswordResetTokenUsed(client: Client, tokenId: number) {
  await ensurePasswordResetTable(client);
  await client.execute({
    sql: "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?",
    args: [tokenId],
  });
}
