import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

let _db: Database.Database | null = null;

export function getDb(readonly = false): Database.Database {
  if (!_db || !_db.open) {
    _db = new Database(DB_PATH, { readonly });
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}
