import { createClient, Client } from "@libsql/client/web";

const AUTO_APPROVE_AFTER_DAYS = 3;
const SWEEP_COOLDOWN_MS = 60_000;

type ModerationSweepResult = {
  advancedApproved: number;
  notesApproved: number;
  skipped: boolean;
};

type ModerationRegistry = typeof globalThis & {
  __xresoModerationSweepAt?: number;
  __xresoModerationSweepRunning?: boolean;
  __xresoModerationSweepPromise?: Promise<ModerationSweepResult>;
};

function getClient(): Client {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function performSweep(): Promise<ModerationSweepResult> {
  const client = getClient();

  // Auto-approve pending notes older than threshold
  const notesResult = await client.execute({
    sql: `UPDATE notes
         SET status = 'approved',
             updated_at = datetime('now')
         WHERE status = 'pending'
           AND datetime(created_at) <= datetime('now', ?)`,
    args: [`-${AUTO_APPROVE_AFTER_DAYS} days`],
  });
  const notesApproved = notesResult.rowsAffected;

  // Refresh category note counts if any notes were approved
  if (notesApproved > 0) {
    await client.execute(
      `UPDATE categories
       SET note_count = (
         SELECT COUNT(*)
         FROM notes
         WHERE notes.category_id = categories.id
           AND notes.status = 'approved'
       )`
    );
  }

  // Auto-approve pending advanced track resources older than threshold
  const advancedResult = await client.execute({
    sql: `UPDATE advanced_track_resources
         SET status = 'approved',
             updated_at = datetime('now')
         WHERE status = 'pending'
           AND datetime(created_at) <= datetime('now', ?)`,
    args: [`-${AUTO_APPROVE_AFTER_DAYS} days`],
  });
  const advancedApproved = advancedResult.rowsAffected;

  return {
    notesApproved,
    advancedApproved,
    skipped: false,
  };
}

/**
 * Runs the auto-approval sweep if enough time has passed since the last run.
 *
 * Uses Turso (@libsql/client) so it works correctly in both local dev
 * and on Vercel serverless functions.
 *
 * The sweep is non-blocking — callers fire-and-forget. Any errors are
 * caught and logged so they never crash the parent request handler.
 */
export function runAutoApprovalSweepIfNeeded(force = false): void {
  const registry = globalThis as ModerationRegistry;
  const now = Date.now();

  // Skip if already running
  if (!force && registry.__xresoModerationSweepRunning) {
    return;
  }

  // Skip if within cooldown
  if (
    !force &&
    registry.__xresoModerationSweepAt &&
    now - registry.__xresoModerationSweepAt < SWEEP_COOLDOWN_MS
  ) {
    return;
  }

  registry.__xresoModerationSweepRunning = true;
  registry.__xresoModerationSweepAt = now;

  // Fire-and-forget — do NOT await this in the calling route
  registry.__xresoModerationSweepPromise = performSweep()
    .then((result) => {
      if (result.notesApproved > 0 || result.advancedApproved > 0) {
        console.log(
          `[Moderation] Auto-approved ${result.notesApproved} note(s), ${result.advancedApproved} advanced resource(s).`
        );
      }
      return result;
    })
    .catch((error) => {
      console.error("[Moderation] Auto-approval sweep failed:", error);
      return { notesApproved: 0, advancedApproved: 0, skipped: true };
    })
    .finally(() => {
      registry.__xresoModerationSweepRunning = false;
    });
}
