import { NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  });
}

type TrackRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  approvedCount: number;
};

type RecommendedTopic = {
  slug: string;
  name: string;
  description: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  sortOrder: number;
};

const RECOMMENDED_TOPICS: RecommendedTopic[] = [
  { slug: "aws", name: "AWS", description: "Amazon Web Services architecture and operations.", level: "Beginner", sortOrder: 0 },
  { slug: "azure", name: "Azure", description: "Microsoft Azure services, identity, and governance.", level: "Beginner", sortOrder: 1 },
  { slug: "gcp", name: "GCP", description: "Google Cloud Platform services and deployment patterns.", level: "Beginner", sortOrder: 2 },
  { slug: "networking-security", name: "Networking & Security", description: "VPC/VNet design, DNS, TLS, IAM, secrets, and perimeter controls.", level: "Intermediate", sortOrder: 3 },
  { slug: "containers-kubernetes", name: "Containers & Kubernetes", description: "Container workloads, orchestration patterns, and production operations.", level: "Intermediate", sortOrder: 4 },
  { slug: "serverless-architecture", name: "Serverless Architecture", description: "Event-driven services, function workflows, and scaling patterns.", level: "Intermediate", sortOrder: 5 },
  { slug: "observability-sre", name: "Observability & SRE", description: "Metrics, logs, tracing, SLIs/SLOs, and reliability operations.", level: "Advanced", sortOrder: 6 },
  { slug: "cost-optimization-finops", name: "Cost Optimization & FinOps", description: "Cloud cost controls, budgeting, and workload right-sizing strategies.", level: "Advanced", sortOrder: 7 },
  { slug: "disaster-recovery", name: "Disaster Recovery", description: "Backup, restore, multi-region resilience, and incident recovery planning.", level: "Advanced", sortOrder: 8 },
];

function normalizeTopicName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "aws fundamentals") return "AWS";
  if (normalized === "azure fundamentals") return "Azure";
  if (normalized === "google cloud fundamentals" || normalized === "gcp fundamentals") return "GCP";
  if (normalized === "cloud fundamentals") return "";
  return name.trim();
}

function looksLikeCloudTrack(track: TrackRow) {
  const slug = track.slug.toLowerCase();
  const name = track.name.toLowerCase();
  return (
    slug.includes("cloud") ||
    name.includes("cloud") ||
    slug.includes("system-design") ||
    name.includes("system design") ||
    slug.includes("api") ||
    name.includes("api")
  );
}

async function ensureRecommendedCloudTopics(client: ReturnType<typeof getClient>, tracks: TrackRow[]) {
  const cloudLikeTracks = tracks.filter(looksLikeCloudTrack);
  if (cloudLikeTracks.length === 0) return;

  for (const track of cloudLikeTracks) {
    for (const topic of RECOMMENDED_TOPICS) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO advanced_track_topics
              (track_id, slug, name, description, level, sort_order)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [track.id, topic.slug, topic.name, topic.description, topic.level, topic.sortOrder],
      });
    }
  }
}

export async function GET() {
  try {
    const client = getClient();

    const trackRowsRes = await client.execute(
        `SELECT
          at.id,
          at.slug,
          at.name,
          at.description,
          at.premium,
          at.status,
          at.sort_order,
          COUNT(CASE WHEN atr.status = 'approved' THEN 1 END) as approved_count
         FROM advanced_tracks at
         LEFT JOIN advanced_track_resources atr ON atr.track_id = at.id
         WHERE at.status = 'active'
         GROUP BY at.id
         ORDER BY at.sort_order ASC, at.name ASC`
    );

    const trackRows = trackRowsRes.rows.map((track) => ({
      id: Number(track.id),
      slug: String(track.slug),
      name: String(track.name),
      description: String(track.description || ""),
      approvedCount: Number(track.approved_count || 0),
    }));

    await ensureRecommendedCloudTopics(client, trackRows);

    const topicRowsRes = await client.execute(
        `SELECT id, track_id, slug, name, description, level, sort_order
         FROM advanced_track_topics
         ORDER BY sort_order ASC, name ASC`
    );

    const topicRows = topicRowsRes.rows;

    const tracks = trackRows.map((track) => ({
      id: track.id,
      slug: track.slug,
      name: track.name,
      description: track.description,
      premium: false,
      approvedCount: track.approvedCount,
      topics: (() => {
        const topicMap = new Map<string, {
          id: number;
          slug: string;
          name: string;
          description: string;
          level: string;
        }>();

        for (const topic of topicRows) {
          if (Number(topic.track_id) !== track.id) continue;

          const displayName = normalizeTopicName(String(topic.name || ""));
          if (!displayName) continue;

          const dedupeKey = displayName.toLowerCase();
          if (topicMap.has(dedupeKey)) continue;

          topicMap.set(dedupeKey, {
            id: Number(topic.id),
            slug: String(topic.slug),
            name: displayName,
            description: String(topic.description || ""),
            level: String(topic.level || "Beginner"),
          });
        }

        return Array.from(topicMap.values());
      })(),
    }));

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("GET /api/advanced-tracks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch advanced tracks" },
      { status: 500 }
    );
  }
}
