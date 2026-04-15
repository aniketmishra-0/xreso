import crypto from "crypto";
import Database from "better-sqlite3";

type PasswordResetRecord = {
  id: number;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
};

export function ensurePasswordResetTable(db: Database.Database) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ).run();

  db.prepare("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash)").run();
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createPasswordResetToken(db: Database.Database, userId: string): string {
  ensurePasswordResetTable(db);

  const token = generateResetToken();
  const tokenHash = hashResetToken(token);

  db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(userId);
  db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', '+1 hour'))`
  ).run(userId, tokenHash);

  return token;
}

export function findActivePasswordResetToken(db: Database.Database, token: string): PasswordResetRecord | undefined {
  ensurePasswordResetTable(db);

  const tokenHash = hashResetToken(token);
  return db
    .prepare(
      `SELECT id, user_id, token_hash, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = ?
         AND used_at IS NULL
         AND expires_at > datetime('now')
       LIMIT 1`
    )
    .get(tokenHash) as PasswordResetRecord | undefined;
}

export function markPasswordResetTokenUsed(db: Database.Database, tokenId: number) {
  ensurePasswordResetTable(db);
  db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(tokenId);
}
