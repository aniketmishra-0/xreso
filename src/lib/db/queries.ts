import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "xreso.db");

function getDb() {
  const sqlite = new Database(DB_PATH, { readonly: true });
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

export async function getFeaturedNotes(limit = 5) {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT n.id, n.title, n.description, n.thumbnail_url, n.view_count, n.bookmark_count,
             n.created_at, n.author_credit, n.author_id,
             c.name as category_name, c.slug as category_slug,
             u.name as author_name, u.github_url as author_github, u.linkedin_url as author_linkedin, u.twitter_url as author_twitter, u.website_url as author_website,
             GROUP_CONCAT(DISTINCT t.name) as tag_names
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.status = 'approved' AND n.featured = 1
      GROUP BY n.id
      ORDER BY n.created_at DESC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];
    db.close();

    return rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      description: r.description as string,
      category: r.category_name as string,
      categorySlug: r.category_slug as string,
      author: r.author_name as string,
      authorId: r.author_id as string,
      authorGithub: r.author_github as string | null,
      authorLinkedin: r.author_linkedin as string | null,
      authorTwitter: r.author_twitter as string | null,
      authorWebsite: r.author_website as string | null,
      thumbnailUrl: r.thumbnail_url as string,
      viewCount: r.view_count as number,
      bookmarkCount: r.bookmark_count as number,
      tags: r.tag_names ? (r.tag_names as string).split(",") : [],
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export async function getCategories(limit = 9) {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM notes n WHERE n.category_id = c.id AND n.status = 'approved') as live_count
      FROM categories c
      ORDER BY live_count DESC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];
    db.close();

    return rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      slug: r.slug as string,
      description: r.description as string,
      icon: r.icon as string,
      gradient: r.gradient as string,
      noteCount: (r.live_count || 0) as number,
    }));
  } catch {
    return [];
  }
}

export async function getLibraryHeroStats() {
  try {
    const db = getDb();

    const row = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM notes n WHERE n.status = 'approved') as notes_indexed,
          (SELECT COUNT(*) FROM users u WHERE u.role = 'user') as registered_learners,
          (
            SELECT COUNT(*)
            FROM (
              SELECT DISTINCT v.user_id as uid
              FROM views v
              WHERE v.user_id IS NOT NULL
                AND v.viewed_at >= datetime('now', '-30 days')
              UNION
              SELECT DISTINCT b.user_id as uid
              FROM bookmarks b
              WHERE b.user_id IS NOT NULL
                AND b.created_at >= datetime('now', '-30 days')
            ) active_users
          ) as active_learners,
          (
            SELECT COUNT(DISTINCT n.author_id)
            FROM notes n
            WHERE n.author_id IS NOT NULL
              AND n.status IN ('approved', 'pending')
          ) as contributors`
      )
      .get() as
      | {
          notes_indexed: number;
          registered_learners: number;
          active_learners: number;
          contributors: number;
        }
      | undefined;

    db.close();

    const notesIndexed = Number(row?.notes_indexed || 0);
    const registeredLearners = Number(row?.registered_learners || 0);
    const recentActiveLearners = Number(row?.active_learners || 0);
    const contributors = Number(row?.contributors || 0);

    return {
      notesIndexed,
      activeLearners:
        recentActiveLearners > 0 ? recentActiveLearners : registeredLearners,
      contributors,
    };
  } catch {
    return {
      notesIndexed: 0,
      activeLearners: 0,
      contributors: 0,
    };
  }
}

export async function getAboutMilestoneStats() {
  try {
    const db = getDb();

    const row = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM notes n WHERE n.status = 'approved') as notes_shared,
          (SELECT COUNT(*) FROM users u WHERE u.role = 'user') as registered_learners,
          (
            SELECT COUNT(*)
            FROM (
              SELECT DISTINCT v.user_id as uid
              FROM views v
              WHERE v.user_id IS NOT NULL
                AND v.viewed_at >= datetime('now', '-30 days')
              UNION
              SELECT DISTINCT b.user_id as uid
              FROM bookmarks b
              WHERE b.user_id IS NOT NULL
                AND b.created_at >= datetime('now', '-30 days')
            ) active_users
          ) as active_learners,
          (
            SELECT COUNT(DISTINCT n.author_id)
            FROM notes n
            WHERE n.author_id IS NOT NULL
              AND n.status IN ('approved', 'pending')
          ) as contributors,
          (SELECT COUNT(*) FROM categories c) as categories_total`
      )
      .get() as
      | {
          notes_shared: number;
          registered_learners: number;
          active_learners: number;
          contributors: number;
          categories_total: number;
        }
      | undefined;

    db.close();

    const notesShared = Number(row?.notes_shared || 0);
    const registeredLearners = Number(row?.registered_learners || 0);
    const recentActiveLearners = Number(row?.active_learners || 0);
    const contributors = Number(row?.contributors || 0);
    const categories = Number(row?.categories_total || 0);

    return {
      notesShared,
      activeLearners:
        recentActiveLearners > 0 ? recentActiveLearners : registeredLearners,
      contributors,
      categories,
    };
  } catch {
    return {
      notesShared: 0,
      activeLearners: 0,
      contributors: 0,
      categories: 0,
    };
  }
}

export async function getNoteById(id: string) {
  try {
    const db = getDb();

    const row = db.prepare(`
      SELECT n.*, c.name as category_name, c.slug as category_slug,
             u.name as author_name, u.avatar as author_avatar
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!row) { db.close(); return null; }

    const tagRows = db.prepare(`
      SELECT t.name FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ?
    `).all(id) as { name: string }[];

    db.close();

    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      category: row.category_name as string,
      categorySlug: row.category_slug as string,
      author: row.author_name as string,
      authorAvatar: row.author_avatar as string | null,
      authorCredit: row.author_credit as string,
      authorId: row.author_id as string,
      thumbnailUrl: row.thumbnail_url as string,
      fileUrl: row.file_url as string,
      fileName: row.file_name as string,
      fileType: row.file_type as string,
      fileSizeBytes: row.file_size_bytes as number,
      sourceUrl: row.source_url as string | null,
      licenseType: row.license_type as string,
      status: row.status as string,
      featured: row.featured === 1,
      viewCount: row.view_count as number,
      bookmarkCount: row.bookmark_count as number,
      tags: tagRows.map((t) => t.name),
      createdAt: row.created_at as string,
    };
  } catch {
    return null;
  }
}

export async function incrementViewCount(noteId: string) {
  try {
    const db = new Database(DB_PATH);
    db.prepare("UPDATE notes SET view_count = view_count + 1 WHERE id = ?").run(noteId);
    db.prepare("INSERT INTO views (note_id) VALUES (?)").run(noteId);
    db.close();
  } catch {
    // silently fail
  }
}
