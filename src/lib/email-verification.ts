import crypto from "crypto";
import { Client } from "@libsql/client/web";

type EmailVerificationRecord = {
  id: number;
  user_id: string;
  token_hash: string;
  expires_at: string;
  verified_at: string | null;
};

export async function ensureEmailVerificationTable(client: Client) {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id)"
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS idx_email_verification_token_hash ON email_verification_tokens(token_hash)"
  );
}

export function hashVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a verification token for a newly registered user.
 * Deletes any existing tokens for the same user first.
 * Token expires in 24 hours.
 */
export async function createEmailVerificationToken(
  client: Client,
  userId: string
): Promise<string> {
  await ensureEmailVerificationTable(client);

  const token = generateVerificationToken();
  const tokenHash = hashVerificationToken(token);

  // Remove any previous tokens for this user
  await client.execute({
    sql: "DELETE FROM email_verification_tokens WHERE user_id = ?",
    args: [userId],
  });

  await client.execute({
    sql: `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', '+24 hours'))`,
    args: [userId, tokenHash],
  });

  return token;
}

/**
 * Find an active (not yet used, not expired) verification token.
 */
export async function findActiveVerificationToken(
  client: Client,
  token: string
): Promise<EmailVerificationRecord | undefined> {
  await ensureEmailVerificationTable(client);

  const tokenHash = hashVerificationToken(token);
  const result = await client.execute({
    sql: `SELECT id, user_id, token_hash, expires_at, verified_at
       FROM email_verification_tokens
       WHERE token_hash = ?
         AND verified_at IS NULL
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
    verified_at: row.verified_at ? String(row.verified_at) : null,
  };
}

/**
 * Mark a verification token as used and update the user's email_verified_at.
 */
export async function markEmailVerified(client: Client, tokenId: number, userId: string) {
  await ensureEmailVerificationTable(client);

  await client.execute({
    sql: "UPDATE email_verification_tokens SET verified_at = datetime('now') WHERE id = ?",
    args: [tokenId],
  });

  await client.execute({
    sql: "UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
    args: [userId],
  });
}
