import { createClient, Client } from "@libsql/client/web";
import { runAutoApprovalSweepIfNeeded } from "@/lib/moderation";

function getClient(): Client {
  runAutoApprovalSweepIfNeeded();

  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured");
  }

  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export async function getFeaturedNotes(limit = 5) {
  try {
    const client = getClient();
    const result = await client.execute({
      sql: `SELECT n.id, n.title, n.description, n.thumbnail_url, n.view_count, n.bookmark_count,
             n.created_at, n.author_credit, n.author_id,
             c.name as category_name, c.slug as category_slug,
             u.name as author_name,
             GROUP_CONCAT(DISTINCT t.name) as tag_names
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.status = 'approved' AND n.featured = 1
      GROUP BY n.id
      ORDER BY n.created_at DESC
      LIMIT ?`,
      args: [limit],
    });

    return result.rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      description: r.description as string,
      category: r.category_name as string,
      categorySlug: r.category_slug as string,
      author: r.author_name as string,
      authorId: r.author_id as string,
      thumbnailUrl: r.thumbnail_url as string,
      viewCount: Number(r.view_count) || 0,
      bookmarkCount: Number(r.bookmark_count) || 0,
      tags: r.tag_names ? String(r.tag_names).split(",") : [],
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export async function getCategories(limit = 9) {
  try {
    const client = getClient();
    const result = await client.execute({
      sql: `SELECT c.*,
        (SELECT COUNT(*) FROM notes n WHERE n.category_id = c.id AND n.status = 'approved') as live_count
      FROM categories c
      ORDER BY live_count DESC
      LIMIT ?`,
      args: [limit],
    });

    return result.rows.map((r) => ({
      id: Number(r.id),
      name: r.name as string,
      slug: r.slug as string,
      description: r.description as string,
      icon: r.icon as string,
      gradient: r.gradient as string,
      noteCount: Number(r.live_count || 0),
    }));
  } catch {
    return [];
  }
}

export async function getLibraryHeroStats() {
  try {
    const client = getClient();
    const result = await client.execute(
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
    );

    const row = result.rows[0];
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
    const client = getClient();
    const result = await client.execute(
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
    );

    const row = result.rows[0];
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

export async function getAdvancedTrackHighlights(
  limitTracks = 3,
  topicsPerTrack = 5
) {
  try {
    const client = getClient();

    const tracksResult = await client.execute({
      sql: `SELECT
          at.id,
          at.slug,
          at.name,
          at.description,
          COUNT(CASE WHEN atr.status = 'approved' THEN 1 END) as approved_count
         FROM advanced_tracks at
         LEFT JOIN advanced_track_resources atr ON atr.track_id = at.id
         WHERE at.status = 'active'
         GROUP BY at.id
         ORDER BY at.sort_order ASC, at.name ASC
         LIMIT ?`,
      args: [limitTracks],
    });

    const topicsResult = await client.execute(
      `SELECT
          track_id,
          slug,
          name,
          level
         FROM advanced_track_topics
         ORDER BY sort_order ASC, name ASC`
    );

    return tracksResult.rows.map((track) => ({
      id: Number(track.id),
      slug: track.slug as string,
      name: track.name as string,
      description: track.description as string,
      resourceCount: Number(track.approved_count || 0),
      topics: topicsResult.rows
        .filter((topic) => Number(topic.track_id) === Number(track.id))
        .slice(0, topicsPerTrack)
        .map((topic) => ({
          slug: topic.slug as string,
          name: topic.name as string,
          level: topic.level as "Beginner" | "Intermediate" | "Advanced",
        })),
    }));
  } catch {
    return [];
  }
}

export async function getAdvancedHeroStats() {
  try {
    const client = getClient();
    const result = await client.execute(
      `SELECT
        (SELECT COUNT(*) FROM advanced_tracks at WHERE at.status = 'active') as track_count,
        (
          SELECT COUNT(*)
          FROM advanced_track_resources atr
          JOIN advanced_tracks at ON atr.track_id = at.id
          WHERE atr.status = 'approved' AND at.status = 'active'
        ) as resource_count,
        (
          SELECT COUNT(*)
          FROM advanced_track_topics att
          JOIN advanced_tracks at ON att.track_id = at.id
          WHERE at.status = 'active'
        ) as topic_count,
        (
          SELECT COUNT(DISTINCT atr.author_id)
          FROM advanced_track_resources atr
          JOIN advanced_tracks at ON atr.track_id = at.id
          WHERE atr.status = 'approved' AND at.status = 'active'
        ) as contributor_count`
    );

    const row = result.rows[0];
    return {
      trackCount: Number(row?.track_count || 0),
      resourceCount: Number(row?.resource_count || 0),
      topicCount: Number(row?.topic_count || 0),
      contributorCount: Number(row?.contributor_count || 0),
    };
  } catch {
    return {
      trackCount: 0,
      resourceCount: 0,
      topicCount: 0,
      contributorCount: 0,
    };
  }
}

export async function getFeaturedAdvancedResources(limit = 6) {
  try {
    const client = getClient();
    const result = await client.execute({
      sql: `SELECT
          atr.id,
          atr.title,
          atr.summary,
          atr.thumbnail_url,
          atr.view_count,
          atr.save_count,
          atr.created_at,
          at.slug as track_slug,
          at.name as track_name,
          att.slug as topic_slug,
          att.name as topic_name,
          u.name as author_name,
          GROUP_CONCAT(DISTINCT atrt.tag) as tag_names
         FROM advanced_track_resources atr
         JOIN advanced_tracks at ON atr.track_id = at.id
         LEFT JOIN advanced_track_topics att ON atr.topic_id = att.id
         LEFT JOIN users u ON atr.author_id = u.id
         LEFT JOIN advanced_track_resource_tags atrt ON atr.id = atrt.resource_id
         WHERE atr.status = 'approved'
           AND at.status = 'active'
         GROUP BY atr.id
         ORDER BY atr.featured DESC, atr.created_at DESC
         LIMIT ?`,
      args: [limit],
    });

    return result.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      summary: row.summary as string,
      thumbnailUrl: row.thumbnail_url as string | null,
      viewCount: Number(row.view_count || 0),
      saveCount: Number(row.save_count || 0),
      createdAt: row.created_at as string,
      trackSlug: row.track_slug as string,
      trackName: row.track_name as string,
      topicSlug: row.topic_slug as string | null,
      topicName: row.topic_name as string | null,
      authorName: (row.author_name || "Unknown") as string,
      tags: row.tag_names ? String(row.tag_names).split(",") : [],
    }));
  } catch {
    return [];
  }
}

export async function getNoteById(id: string) {
  try {
    const client = getClient();

    const result = await client.execute({
      sql: `SELECT n.*, c.name as category_name, c.slug as category_slug,
             u.name as author_name, u.avatar as author_avatar
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      LEFT JOIN users u ON n.author_id = u.id
      WHERE n.id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    const tagResult = await client.execute({
      sql: `SELECT t.name FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ?`,
      args: [id],
    });

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
      fileSizeBytes: Number(row.file_size_bytes),
      sourceUrl: row.source_url as string | null,
      licenseType: row.license_type as string,
      status: row.status as string,
      featured: row.featured === 1,
      viewCount: Number(row.view_count),
      bookmarkCount: Number(row.bookmark_count),
      tags: tagResult.rows.map((t) => String(t.name)),
      createdAt: row.created_at as string,
    };
  } catch {
    return null;
  }
}

export async function incrementViewCount(noteId: string) {
  try {
    const client = getClient();
    await client.execute({
      sql: "UPDATE notes SET view_count = view_count + 1 WHERE id = ?",
      args: [noteId],
    });
    await client.execute({
      sql: "INSERT INTO views (note_id) VALUES (?)",
      args: [noteId],
    });
  } catch {
    // silently fail
  }
}
