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
      premium_access INTEGER NOT NULL DEFAULT 0,
      premium_expires_at TEXT,
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

    CREATE TABLE IF NOT EXISTS advanced_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      premium INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advanced_track_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL REFERENCES advanced_tracks(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT 'Beginner',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(track_id, slug)
    );

    CREATE TABLE IF NOT EXISTS advanced_track_resources (
      id TEXT PRIMARY KEY,
      track_id INTEGER NOT NULL REFERENCES advanced_tracks(id) ON DELETE CASCADE,
      topic_id INTEGER REFERENCES advanced_track_topics(id) ON DELETE SET NULL,
      author_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      resource_type TEXT NOT NULL DEFAULT 'link',
      content_url TEXT NOT NULL,
      thumbnail_url TEXT,
      premium_only INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      view_count INTEGER NOT NULL DEFAULT 0,
      save_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advanced_track_resource_tags (
      resource_id TEXT NOT NULL REFERENCES advanced_track_resources(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY(resource_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_advanced_track_topics_track_id ON advanced_track_topics(track_id);
    CREATE INDEX IF NOT EXISTS idx_advanced_track_resources_track_id ON advanced_track_resources(track_id);
    CREATE INDEX IF NOT EXISTS idx_advanced_track_resources_status ON advanced_track_resources(status);

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, description, tags, content='');
  `);

  // Keep seed compatible with pre-premium local DBs.
  try {
    db.exec("ALTER TABLE users ADD COLUMN premium_access INTEGER NOT NULL DEFAULT 0;");
  } catch {
    // Column already exists.
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN premium_expires_at TEXT;");
  } catch {
    // Column already exists.
  }

  console.log("✅ Tables created\n");

  // ── Users ──────────────────────────────────
  const adminId = uuidv4();
  const userId1 = uuidv4();
  const userId2 = uuidv4();

  const premiumTrialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (id, name, email, password, role, bio, premium_access, premium_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertUser.run(
    adminId,
    "Admin",
    "admin@xreso.dev",
    hashSync("admin123", 10),
    "admin",
    "Platform administrator",
    1,
    null
  );
  insertUser.run(
    userId1,
    "Priya Sharma",
    "priya@example.com",
    hashSync("user123", 10),
    "user",
    "CS student and note enthusiast",
    1,
    premiumTrialEndsAt
  );
  insertUser.run(
    userId2,
    "Rahul Dev",
    "rahul@example.com",
    hashSync("user123", 10),
    "user",
    "Full-stack developer",
    0,
    null
  );
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

  // ── Advanced Tracks Module (separate from notes) ─────
  const advancedTracks = [
    ["kubernetes", "Kubernetes", "Container orchestration, production scaling, and cluster operations.", 0],
    ["devops", "DevOps", "Automation, CI/CD, infrastructure, and delivery reliability.", 1],
    ["system-design", "System Design", "Scalable architecture patterns and system tradeoffs.", 2],
  ] as const;

  const insertAdvancedTrack = db.prepare(
    `INSERT OR IGNORE INTO advanced_tracks (slug, name, description, premium, status, sort_order)
     VALUES (?, ?, ?, 1, 'active', ?)`
  );

  advancedTracks.forEach((track) => {
    insertAdvancedTrack.run(track[0], track[1], track[2], track[3]);
  });

  const advancedTrackMap: Record<string, number> = {};
  const advancedTrackRows = db.prepare("SELECT id, slug FROM advanced_tracks").all() as {
    id: number;
    slug: string;
  }[];
  advancedTrackRows.forEach((row) => {
    advancedTrackMap[row.slug] = row.id;
  });

  const advancedTopics = [
    ["kubernetes", "k8s-fundamentals", "Cluster Fundamentals", "Pods, deployments, and rollout strategy.", "Beginner", 0],
    ["kubernetes", "k8s-observability", "Observability", "Production logs, metrics, tracing, and probes.", "Advanced", 1],
    ["devops", "linux-shell", "Linux and Shell", "Linux CLI, permissions, shell scripting, and process tools.", "Beginner", 0],
    ["devops", "ansible-automation", "Ansible Automation", "Playbooks, roles, and idempotent infra tasks.", "Intermediate", 1],
    ["system-design", "requirements-capacity", "Capacity Planning", "Estimating scale and sizing architecture choices.", "Beginner", 0],
    ["system-design", "resilience-observability", "Reliability and Observability", "SLIs, alerts, and resilience engineering.", "Advanced", 1],
  ] as const;

  const insertAdvancedTopic = db.prepare(
    `INSERT OR IGNORE INTO advanced_track_topics
      (track_id, slug, name, description, level, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  advancedTopics.forEach((topic) => {
    const trackId = advancedTrackMap[topic[0]];
    if (!trackId) return;
    insertAdvancedTopic.run(trackId, topic[1], topic[2], topic[3], topic[4], topic[5]);
  });

  const topicMap: Record<string, number> = {};
  const topicRows = db.prepare("SELECT id, slug FROM advanced_track_topics").all() as {
    id: number;
    slug: string;
  }[];
  topicRows.forEach((row) => {
    topicMap[row.slug] = row.id;
  });

  const insertAdvancedResource = db.prepare(
    `INSERT OR IGNORE INTO advanced_track_resources
      (id, track_id, topic_id, author_id, title, summary, resource_type, content_url, thumbnail_url, premium_only, featured, status, view_count, save_count)
     VALUES (?, ?, ?, ?, ?, ?, 'link', ?, ?, 1, ?, ?, ?, ?)`
  );

  const insertAdvancedResourceTag = db.prepare(
    "INSERT OR IGNORE INTO advanced_track_resource_tags (resource_id, tag) VALUES (?, ?)"
  );

  const sampleAdvancedResources = [
    {
      trackSlug: "devops",
      topicSlug: "linux-shell",
      title: "Linux Command-Line Operations Handbook",
      summary: "Practical Linux operations checklist for DevOps onboarding.",
      contentUrl: "https://example.com/advanced/linux-operations",
      thumbnailUrl: "/api/og?title=Linux%20Command-Line%20Operations%20Handbook&category=DevOps&v=3",
      featured: 1,
      status: "approved",
      viewCount: 188,
      saveCount: 34,
      tags: ["linux", "devops", "automation"],
    },
    {
      trackSlug: "kubernetes",
      topicSlug: "k8s-observability",
      title: "Kubernetes Production Observability Playbook",
      summary: "Runbook templates for metrics, logs, and incident debugging in Kubernetes.",
      contentUrl: "https://example.com/advanced/kubernetes-observability",
      thumbnailUrl: "/api/og?title=Kubernetes%20Production%20Observability%20Playbook&category=Kubernetes&v=3",
      featured: 0,
      status: "approved",
      viewCount: 142,
      saveCount: 27,
      tags: ["kubernetes", "observability", "sre"],
    },
  ] as const;

  sampleAdvancedResources.forEach((resource) => {
    const trackId = advancedTrackMap[resource.trackSlug];
    const topicId = topicMap[resource.topicSlug];
    if (!trackId) return;

    const resourceId = uuidv4();
    insertAdvancedResource.run(
      resourceId,
      trackId,
      topicId || null,
      adminId,
      resource.title,
      resource.summary,
      resource.contentUrl,
      resource.thumbnailUrl,
      resource.featured,
      resource.status,
      resource.viewCount,
      resource.saveCount
    );

    resource.tags.forEach((tag) => {
      insertAdvancedResourceTag.run(resourceId, tag);
    });
  });

  console.log("✅ Seeded advanced tracks module");

  db.close();
  console.log("\n🎉 Database seeded successfully!");
  console.log(`📁 Database file: ${DB_PATH}`);
}

seed().catch(console.error);
