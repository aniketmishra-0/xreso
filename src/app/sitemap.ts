import { MetadataRoute } from "next";
import Database from "better-sqlite3";
import path from "path";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://xreso.dev";
const DB_PATH = path.join(process.cwd(), "xreso.db");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/browse`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/tracks`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${APP_URL}/tracks/notes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.75 },
    { url: `${APP_URL}/admin/advanced-tracks`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${APP_URL}/upload`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_URL}/guidelines`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/api`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.35 },
    { url: `${APP_URL}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/dmca`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.25 },
    { url: `${APP_URL}/licenses`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.25 },
    { url: `${APP_URL}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamic note pages
  let notePages: MetadataRoute.Sitemap = [];
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const allNotes = db
      .prepare("SELECT id, updated_at FROM notes WHERE status = 'approved'")
      .all() as { id: string; updated_at: string }[];

    notePages = allNotes.map((note) => ({
      url: `${APP_URL}/note/${note.id}`,
      lastModified: new Date(note.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const allCategories = db
      .prepare("SELECT slug FROM categories")
      .all() as { slug: string }[];

    const categoryPages = allCategories.map((cat) => ({
      url: `${APP_URL}/browse?category=${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    db.close();
    return [...staticPages, ...notePages, ...categoryPages];
  } catch (e) {
    console.error("Sitemap generation error:", e);
  }

  return staticPages;
}
