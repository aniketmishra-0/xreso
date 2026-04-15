import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"), // hashed, null for OAuth
  avatar: text("avatar"),
  bio: text("bio"),
  role: text("role", { enum: ["user", "admin", "moderator"] })
    .notNull()
    .default("user"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Categories ───────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  gradient: text("gradient"),
  noteCount: integer("note_count").notNull().default(0),
});

// ─── Notes ────────────────────────────────────────────
export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  authorCredit: text("author_credit").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  sourceUrl: text("source_url"),
  licenseType: text("license_type")
    .notNull()
    .default("CC-BY-4.0"),
  status: text("status", {
    enum: ["pending", "approved", "rejected"],
  })
    .notNull()
    .default("pending"),
  featured: integer("featured", { mode: "boolean" })
    .notNull()
    .default(false),
  viewCount: integer("view_count").notNull().default(0),
  bookmarkCount: integer("bookmark_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Tags ─────────────────────────────────────────────
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

// ─── Note Tags (junction) ─────────────────────────────
export const noteTags = sqliteTable("note_tags", {
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

// ─── Bookmarks ────────────────────────────────────────
export const bookmarks = sqliteTable("bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── View Tracking (Analytics) ────────────────────────
export const views = sqliteTable("views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  ipHash: text("ip_hash"),
  viewedAt: text("viewed_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Reports ──────────────────────────────────────────
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  reporterId: text("reporter_id")
    .references(() => users.id),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status", {
    enum: ["pending", "reviewed", "dismissed"],
  })
    .notNull()
    .default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Advanced Tracks (Premium Module) ─────────────────
export const advancedTracks = sqliteTable("advanced_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  premium: integer("premium", { mode: "boolean" }).notNull().default(true),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const advancedTrackTopics = sqliteTable("advanced_track_topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: integer("track_id")
    .notNull()
    .references(() => advancedTracks.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  level: text("level", { enum: ["Beginner", "Intermediate", "Advanced"] })
    .notNull()
    .default("Beginner"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const advancedTrackResources = sqliteTable("advanced_track_resources", {
  id: text("id").primaryKey(),
  trackId: integer("track_id")
    .notNull()
    .references(() => advancedTracks.id, { onDelete: "cascade" }),
  topicId: integer("topic_id").references(() => advancedTrackTopics.id, {
    onDelete: "set null",
  }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  resourceType: text("resource_type", {
    enum: ["link", "pdf", "doc", "video"],
  })
    .notNull()
    .default("link"),
  contentUrl: text("content_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  premiumOnly: integer("premium_only", { mode: "boolean" })
    .notNull()
    .default(true),
  featured: integer("featured", { mode: "boolean" })
    .notNull()
    .default(false),
  status: text("status", {
    enum: ["draft", "pending", "approved", "rejected", "archived"],
  })
    .notNull()
    .default("pending"),
  viewCount: integer("view_count").notNull().default(0),
  saveCount: integer("save_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const advancedTrackResourceTags = sqliteTable(
  "advanced_track_resource_tags",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => advancedTrackResources.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  }
);

// ─── TypeScript Types ─────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type AdvancedTrack = typeof advancedTracks.$inferSelect;
export type NewAdvancedTrack = typeof advancedTracks.$inferInsert;
export type AdvancedTrackTopic = typeof advancedTrackTopics.$inferSelect;
export type NewAdvancedTrackTopic = typeof advancedTrackTopics.$inferInsert;
export type AdvancedTrackResource = typeof advancedTrackResources.$inferSelect;
export type NewAdvancedTrackResource = typeof advancedTrackResources.$inferInsert;
