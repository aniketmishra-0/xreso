import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");
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
};

function rebuildNotesFtsIndex(sqlite: Database.Database) {
  sqlite.prepare("INSERT INTO notes_fts(notes_fts) VALUES('delete-all')").run();
  sqlite
    .prepare(
      `INSERT INTO notes_fts(rowid, title, description, tags)
       SELECT n.rowid,
              n.title,
              n.description,
              COALESCE((
                SELECT GROUP_CONCAT(t.name, ' ')
                FROM note_tags nt
                JOIN tags t ON nt.tag_id = t.id
                WHERE nt.note_id = n.id
              ), '')
       FROM notes n
       WHERE n.status = 'approved'`
    )
    .run();
}

export function runAutoApprovalSweepIfNeeded(force = false): ModerationSweepResult {
  const registry = globalThis as ModerationRegistry;
  const now = Date.now();

  if (!force && registry.__xresoModerationSweepRunning) {
    return { notesApproved: 0, advancedApproved: 0, skipped: true };
  }

  if (
    !force &&
    registry.__xresoModerationSweepAt &&
    now - registry.__xresoModerationSweepAt < SWEEP_COOLDOWN_MS
  ) {
    return { notesApproved: 0, advancedApproved: 0, skipped: true };
  }

  registry.__xresoModerationSweepRunning = true;
  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(DB_PATH);
    sqlite.pragma("foreign_keys = ON");

    const notesApproved = sqlite
      .prepare(
        `UPDATE notes
         SET status = 'approved',
             updated_at = datetime('now')
         WHERE status = 'pending'
           AND datetime(created_at) <= datetime('now', ?)`
      )
      .run(`-${AUTO_APPROVE_AFTER_DAYS} days`).changes;

    if (notesApproved > 0) {
      rebuildNotesFtsIndex(sqlite);
      sqlite.exec(
        `UPDATE categories
         SET note_count = (
           SELECT COUNT(*)
           FROM notes
           WHERE notes.category_id = categories.id
             AND notes.status = 'approved'
         )`
      );
    }

    const advancedApproved = sqlite
      .prepare(
        `UPDATE advanced_track_resources
         SET status = 'approved',
             updated_at = datetime('now')
         WHERE status = 'pending'
           AND datetime(created_at) <= datetime('now', ?)`
      )
      .run(`-${AUTO_APPROVE_AFTER_DAYS} days`).changes;

    registry.__xresoModerationSweepAt = now;

    return {
      notesApproved,
      advancedApproved,
      skipped: false,
    };
  } catch (error) {
    console.error("[Moderation] Auto-approval sweep failed:", error);
    return { notesApproved: 0, advancedApproved: 0, skipped: true };
  } finally {
    registry.__xresoModerationSweepRunning = false;
    sqlite?.close();
  }
}
