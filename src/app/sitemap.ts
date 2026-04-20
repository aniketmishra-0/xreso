import { MetadataRoute } from "next";
import { createClient } from "@libsql/client/web";
import { SITE_URL } from "@/lib/site";

function getClient() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) return null;
  return createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/browse`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tracks`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/tracks/notes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.75 },
    { url: `${SITE_URL}/admin/advanced-tracks`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${SITE_URL}/upload`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/guidelines`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/api`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.35 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/dmca`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.25 },
    { url: `${SITE_URL}/licenses`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.25 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamic note pages
  try {
    const client = getClient();
    if (!client) return staticPages;

    const notesResult = await client.execute(
      "SELECT id, updated_at FROM notes WHERE status = 'approved'"
    );

    const notePages: MetadataRoute.Sitemap = notesResult.rows.map((note) => ({
      url: `${SITE_URL}/note/${note.id}`,
      lastModified: new Date(String(note.updated_at)),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const categoriesResult = await client.execute("SELECT slug FROM categories");

    const categoryPages: MetadataRoute.Sitemap = categoriesResult.rows.map((cat) => ({
      url: `${SITE_URL}/browse?category=${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...notePages, ...categoryPages];
  } catch (e) {
    console.error("Sitemap generation error:", e);
  }

  return staticPages;
}
