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

export async function getTrendingNotes(limit = 6) {
  try {
    const client = getClient();

    // Read curated views threshold from admin settings (default: 500)
    let threshold = 500;
    try {
      const settingsResult = await client.execute({
        sql: "SELECT value FROM settings WHERE key = 'curated_views_threshold'",
        args: [],
      });
      if (settingsResult.rows.length > 0) {
        const parsed = parseInt(String(settingsResult.rows[0].value), 10);
        if (!isNaN(parsed) && parsed > 0) threshold = parsed;
      }
    } catch {
      // settings table may not exist yet, use default
    }

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
      WHERE n.status = 'approved' AND n.view_count >= ?
      GROUP BY n.id
      ORDER BY n.view_count DESC, n.created_at DESC
      LIMIT ?`,
      args: [threshold, limit],
    });

    return {
      threshold,
      notes: result.rows.map((r) => ({
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
      })),
    };
  } catch {
    return { threshold: 500, notes: [] };
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

// ─── VIDEO QUERIES ────────────────────────────────────

export async function getApprovedVideos(
  limit = 12,
  offset = 0,
  categoryId?: number,
  searchQuery?: string,
  sortBy: "newest" | "popular" = "newest"
) {
  try {
    const client = getClient();

    try {
      await client.execute({
        sql: "ALTER TABLE videos ADD COLUMN channel_name text",
        args: [],
      });
    } catch {
      // Column already exists in migrated databases.
    }

    try {
      await client.execute({
        sql: "ALTER TABLE videos ADD COLUMN channel_url text",
        args: [],
      });
    } catch {
      // Column already exists in migrated databases.
    }

    let sql = `
      SELECT 
        v.id, v.title, v.description, v.thumbnail_url, v.video_type, v.video_id,
        v.view_count, v.created_at, v.author_credit, v.author_id,
        c.name as category_name, c.slug as category_slug,
        u.name as author_name
      FROM videos v
      LEFT JOIN categories c ON v.category_id = c.id
      LEFT JOIN users u ON v.author_id = u.id
      WHERE v.status = 'approved'
    `;

    const args: any[] = [];

    if (categoryId) {
      sql += ` AND v.category_id = ?`;
      args.push(categoryId);
    }

    if (searchQuery) {
      sql += ` AND (v.title LIKE ? OR v.description LIKE ?)`;
      const searchTerm = `%${searchQuery}%`;
      args.push(searchTerm, searchTerm);
    }

    sql +=
      sortBy === "popular"
        ? ` ORDER BY v.view_count DESC, v.created_at DESC`
        : ` ORDER BY v.created_at DESC`;

    sql += ` LIMIT ? OFFSET ?`;
    args.push(limit, offset);

    const result = await client.execute({
      sql,
      args,
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
      videoType: r.video_type as string,
      videoId: r.video_id as string,
      viewCount: Number(r.view_count) || 0,
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export async function getVideoById(id: string) {
  try {
    const client = getClient();
    try {
      await client.execute({
        sql: "ALTER TABLE videos ADD COLUMN channel_name text",
        args: [],
      });
    } catch {
      // Column already exists in migrated databases.
    }

    try {
      await client.execute({
        sql: "ALTER TABLE videos ADD COLUMN channel_url text",
        args: [],
      });
    } catch {
      // Column already exists in migrated databases.
    }

    const result = await client.execute({
      sql: `
        SELECT 
          v.*, 
          c.name as category_name, c.slug as category_slug,
          u.name as author_name
        FROM videos v
        LEFT JOIN categories c ON v.category_id = c.id
        LEFT JOIN users u ON v.author_id = u.id
        WHERE v.id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      categoryId: Number(row.category_id),
      category: row.category_name as string,
      categorySlug: row.category_slug as string,
      authorId: row.author_id as string,
      authorCredit: row.author_credit as string,
      authorName: row.author_name as string,
      videoUrl: row.video_url as string,
      videoType: row.video_type as string,
      videoId: row.video_id as string,
      thumbnailUrl: row.thumbnail_url as string,
      channelName: row.channel_name as string,
      channelUrl: row.channel_url as string,
      duration: row.duration as string,
      licenseType: row.license_type as string,
      status: row.status as string,
      featured: Boolean(row.featured),
      viewCount: Number(row.view_count) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  } catch {
    return null;
  }
}

export async function createVideo(videoData: {
  id: string;
  title: string;
  description: string;
  categoryId: number;
  authorId: string;
  authorCredit: string;
  videoUrl: string;
  videoType: "youtube" | "vimeo";
  videoId: string;
  thumbnailUrl: string;
  channelName?: string;
  channelUrl?: string;
  licenseType?: string;
}) {
  try {
    const client = getClient();
    try {
      await client.execute({
        sql: "ALTER TABLE videos ADD COLUMN channel_name text",
        args: [],
      });
    } catch {
      // Column already exists in migrated databases.
    }

    try {
      await client.execute({
        sql: "ALTER TABLE videos ADD COLUMN channel_url text",
        args: [],
      });
    } catch {
      // Column already exists in migrated databases.
    }

    await client.execute({
      sql: `
        INSERT INTO videos (
          id, title, description, category_id, author_id, author_credit,
          video_url, video_type, video_id, thumbnail_url, channel_name, channel_url, license_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        videoData.id,
        videoData.title,
        videoData.description,
        videoData.categoryId,
        videoData.authorId,
        videoData.authorCredit,
        videoData.videoUrl,
        videoData.videoType,
        videoData.videoId,
        videoData.thumbnailUrl,
        videoData.channelName?.trim() || null,
        videoData.channelUrl?.trim() || null,
        videoData.licenseType || "CC-BY-4.0",
        "approved",
      ],
    });

    return true;
  } catch (error) {
    console.error("createVideo failed:", error);
    return false;
  }
}

export async function incrementVideoViewCount(videoId: string) {
  try {
    const client = getClient();
    await client.execute({
      sql: "UPDATE videos SET view_count = view_count + 1 WHERE id = ?",
      args: [videoId],
    });
  } catch {
    // silently fail
  }
}

export async function getTrendingVideos(limit = 6) {
  try {
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT 
          v.id, v.title, v.thumbnail_url, v.video_type, v.video_id,
          v.view_count, v.created_at, v.author_credit,
          c.name as category_name, c.slug as category_slug
        FROM videos v
        LEFT JOIN categories c ON v.category_id = c.id
        WHERE v.status = 'approved'
        ORDER BY v.view_count DESC, v.created_at DESC
        LIMIT ?
      `,
      args: [limit],
    });

    return result.rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      category: r.category_name as string,
      categorySlug: r.category_slug as string,
      thumbnailUrl: r.thumbnail_url as string,
      videoType: r.video_type as string,
      videoId: r.video_id as string,
      viewCount: Number(r.view_count) || 0,
      authorCredit: r.author_credit as string,
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export async function countApprovedVideos(categoryId?: number) {
  try {
    const client = getClient();

    let sql = "SELECT COUNT(*) as count FROM videos WHERE status = 'approved'";
    const args: any[] = [];

    if (categoryId) {
      sql += " AND category_id = ?";
      args.push(categoryId);
    }

    const result = await client.execute({ sql, args });
    return Number(result.rows[0]?.count || 0);
  } catch {
    return 0;
  }
}
