import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

async function seed() {
  console.log("🌱 Seeding xreso database...\n");

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // ── Create Tables ─────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT,
      avatar TEXT,
      bio TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      gradient TEXT,
      note_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      author_id TEXT NOT NULL REFERENCES users(id),
      author_credit TEXT NOT NULL,
      thumbnail_url TEXT,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      source_url TEXT,
      license_type TEXT NOT NULL DEFAULT 'CC-BY-4.0',
      status TEXT NOT NULL DEFAULT 'pending',
      featured INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      bookmark_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id TEXT,
      ip_hash TEXT,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      reporter_id TEXT REFERENCES users(id),
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, description, tags, content='');
  `);
  console.log("✅ Tables created\n");

  // ── Users ──────────────────────────────────
  const adminId = uuidv4();
  const userId1 = uuidv4();
  const userId2 = uuidv4();

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (id, name, email, password, role, bio) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertUser.run(adminId, "Admin", "admin@xreso.dev", hashSync("admin123", 10), "admin", "Platform administrator");
  insertUser.run(userId1, "Priya Sharma", "priya@example.com", hashSync("user123", 10), "user", "CS student and note enthusiast");
  insertUser.run(userId2, "Rahul Dev", "rahul@example.com", hashSync("user123", 10), "user", "Full-stack developer");
  console.log("✅ Seeded 3 users");

  // ── Categories ─────────────────────────────
  const insertCat = db.prepare(
    "INSERT OR IGNORE INTO categories (name, slug, description, icon, gradient) VALUES (?, ?, ?, ?, ?)"
  );
  const cats = [
    ["Python", "python", "Python programming notes", "🐍", "linear-gradient(135deg, #3776AB, #FFD43B)"],
    ["JavaScript", "javascript", "JavaScript & TypeScript notes", "⚡", "linear-gradient(135deg, #F7DF1E, #323330)"],
    ["SQL", "sql", "SQL & database notes", "🗃️", "linear-gradient(135deg, #336791, #4479A1)"],
    ["Java", "java", "Java programming notes", "☕", "linear-gradient(135deg, #ED8B00, #5382A1)"],
    ["Data Structures", "data-structures", "DSA and algorithms", "🌳", "linear-gradient(135deg, #FF6B6B, #4ECDC4)"],
    ["Web Dev", "web-dev", "Web development notes", "🌐", "linear-gradient(135deg, #E44D26, #1572B6)"],
    ["C / C++", "c-cpp", "C and C++ programming", "⚙️", "linear-gradient(135deg, #00599C, #A8B9CC)"],
    ["DevOps", "devops", "DevOps and CI/CD", "🐳", "linear-gradient(135deg, #2496ED, #326CE5)"],
    ["Other", "other", "Miscellaneous notes", "📝", "linear-gradient(135deg, #667eea, #764ba2)"],
  ];
  for (const c of cats) insertCat.run(...c);
  console.log("✅ Seeded 9 categories");

  // ── Tags ───────────────────────────────────
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)");
  const tagNames = [
    "beginner", "intermediate", "advanced", "loops", "functions", "oop",
    "arrays", "strings", "recursion", "sorting", "searching", "trees",
    "graphs", "dynamic-programming", "joins", "subqueries", "normalization",
    "indexing", "html", "css", "react", "nodejs", "api", "docker",
    "kubernetes", "ci-cd", "linux", "pointers", "memory", "data-types",
    "variables", "algorithms", "patterns", "optimization",
  ];
  for (const t of tagNames) insertTag.run(t, t);
  console.log(`✅ Seeded ${tagNames.length} tags`);

  // ── Sample Notes ───────────────────────────
  const catMap: Record<string, number> = {};
  for (const row of db.prepare("SELECT id, slug FROM categories").all() as { id: number; slug: string }[]) {
    catMap[row.slug] = row.id;
  }
  const tagMap: Record<string, number> = {};
  for (const row of db.prepare("SELECT id, slug FROM tags").all() as { id: number; slug: string }[]) {
    tagMap[row.slug] = row.id;
  }

  const sampleNotes = [
    { title: "SQL Joins Explained — Visual Guide", desc: "Complete visual reference for INNER, LEFT, RIGHT, FULL OUTER, and CROSS joins with real examples.", cat: "sql", author: userId1, tags: ["joins", "beginner"] },
    { title: "Python List Comprehensions", desc: "Handwritten cheat sheet covering list, dict, and set comprehensions with nested examples.", cat: "python", author: userId1, tags: ["loops", "arrays", "beginner"] },
    { title: "JavaScript Async/Await Deep Dive", desc: "Understanding promises, async/await patterns, and error handling in modern JavaScript.", cat: "javascript", author: userId2, tags: ["functions", "intermediate"] },
    { title: "Binary Search Tree Operations", desc: "Insert, delete, search, and traversal operations on BSTs with time complexity analysis.", cat: "data-structures", author: userId2, tags: ["trees", "searching", "algorithms"] },
    { title: "React Hooks Cheatsheet", desc: "useState, useEffect, useContext, useReducer, and custom hooks with practical examples.", cat: "javascript", author: userId1, tags: ["react", "functions", "intermediate"] },
    { title: "SQL Subqueries & CTEs", desc: "Common Table Expressions and subquery patterns for complex database queries.", cat: "sql", author: userId2, tags: ["subqueries", "advanced"] },
    { title: "Java OOP Fundamentals", desc: "Classes, inheritance, polymorphism, abstraction, and encapsulation explained with diagrams.", cat: "java", author: userId1, tags: ["oop", "beginner"] },
    { title: "Docker Essentials for Developers", desc: "Dockerfile, docker-compose, volumes, networks — everything you need to containerize apps.", cat: "devops", author: userId2, tags: ["docker", "beginner"] },
  ];

  const insertNote = db.prepare(`INSERT OR IGNORE INTO notes (id, title, description, category_id, author_id, author_credit, thumbnail_url, file_url, file_name, file_type, file_size_bytes, license_type, status, featured, view_count, bookmark_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertNoteTag = db.prepare("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)");
  const insertFts = db.prepare("INSERT INTO notes_fts(rowid, title, description, tags) VALUES (?, ?, ?, ?)");

  for (let i = 0; i < sampleNotes.length; i++) {
    const n = sampleNotes[i];
    const noteId = uuidv4();
    const credit = n.author === userId1 ? "Priya Sharma" : "Rahul Dev";
    const status = i === 7 ? "pending" : "approved";

    insertNote.run(noteId, n.title, n.desc, catMap[n.cat], n.author, credit,
      `/placeholder-thumb-${(i % 4) + 1}.png`, `/placeholder-note-${(i % 4) + 1}.png`,
      `note-${i + 1}.png`, "image/png", Math.floor(Math.random() * 3000000) + 500000,
      "CC-BY-4.0", status, i < 4 ? 1 : 0,
      Math.floor(Math.random() * 500) + 50, Math.floor(Math.random() * 50) + 5);

    for (const t of n.tags) {
      if (tagMap[t]) insertNoteTag.run(noteId, tagMap[t]);
    }

    if (status === "approved") {
      const rowid = (db.prepare("SELECT rowid FROM notes WHERE id = ?").get(noteId) as { rowid: number })?.rowid;
      if (rowid) insertFts.run(rowid, n.title, n.desc, n.tags.join(" "));
    }
  }
  console.log(`✅ Seeded ${sampleNotes.length} notes`);

  // Update category counts
  db.exec(`UPDATE categories SET note_count = (SELECT COUNT(*) FROM notes WHERE notes.category_id = categories.id AND notes.status = 'approved')`);

  db.close();
  console.log("\n🎉 Database seeded successfully!");
  console.log(`📁 Database file: ${DB_PATH}`);
}

seed().catch(console.error);
