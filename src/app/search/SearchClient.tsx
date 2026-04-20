"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type UniversalNote = {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  createdAt: string;
};

type UniversalVideo = {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  createdAt: string;
};

type UniversalCategory = {
  id: number;
  name: string;
  slug: string;
  description: string;
  noteCount: number;
};

type UniversalTrack = {
  id: number;
  slug: string;
  name: string;
  description: string;
  approvedCount: number;
};

type UniversalResource = {
  id: string;
  title: string;
  summary: string;
  trackSlug: string;
  trackName: string;
  topicSlug: string;
  topicName: string;
  createdAt: string;
};

type UniversalPayload = {
  query: string;
  notes: UniversalNote[];
  videos: UniversalVideo[];
  categories: UniversalCategory[];
  tracks: UniversalTrack[];
  resources: UniversalResource[];
};

function formatDate(value: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function SearchClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryFromUrl = (searchParams.get("q") || "").trim();

  const [searchInput, setSearchInput] = useState(queryFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<UniversalPayload>({
    query: "",
    notes: [],
    videos: [],
    categories: [],
    tracks: [],
    resources: [],
  });

  const normalizedSearch = searchInput.trim();

  useEffect(() => {
    const nextQuery = normalizedSearch;
    const nextUrl = nextQuery ? `${pathname}?q=${encodeURIComponent(nextQuery)}` : pathname;
    router.replace(nextUrl, { scroll: false });

    if (!nextQuery) {
      setPayload({
        query: "",
        notes: [],
        videos: [],
        categories: [],
        tracks: [],
        resources: [],
      });
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const run = async () => {
        setLoading(true);
        setError("");

        try {
          const response = await fetch(`/api/search/universal?q=${encodeURIComponent(nextQuery)}&limit=8`, {
            cache: "no-store",
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error("Search failed");
          }

          const data = (await response.json()) as UniversalPayload;
          if (!cancelled) {
            setPayload(data);
          }
        } catch {
          if (!cancelled) {
            setError("Could not load search results right now.");
            setPayload({
              query: nextQuery,
              notes: [],
              videos: [],
              categories: [],
              tracks: [],
              resources: [],
            });
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      void run();
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedSearch, pathname, router]);

  const totalResults = useMemo(
    () =>
      payload.notes.length +
      payload.videos.length +
      payload.categories.length +
      payload.tracks.length +
      payload.resources.length,
    [payload]
  );

  const recommendations = useMemo(() => {
    const staticSuggestions = [
      "SQL",
      "Python",
      "System Design",
      "React",
      "Docker",
      "Kubernetes",
      "JavaScript",
      "DevOps",
    ];

    if (!normalizedSearch) {
      return staticSuggestions.slice(0, 6);
    }

    const pool = [
      ...payload.notes.map((item) => item.title),
      ...payload.videos.map((item) => item.title),
      ...payload.categories.map((item) => item.name),
      ...payload.tracks.map((item) => item.name),
      ...payload.resources.map((item) => item.title),
      ...staticSuggestions,
    ];

    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of pool) {
      const normalized = value.trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      if (!key.includes(normalizedSearch.toLowerCase()) && output.length >= 3) continue;
      seen.add(key);
      output.push(normalized);
      if (output.length >= 8) break;
    }

    return output;
  }, [normalizedSearch, payload]);

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Universal Search</h1>
          <p className={styles.subtitle}>Search across notes, videos, categories, tracks, and advanced resources.</p>

          <form
            className={styles.searchWrap}
            onSubmit={(event) => {
              event.preventDefault();
              setSearchInput((current) => current.trim());
            }}
          >
            <input
              type="text"
              data-global-search-input="true"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search everything in xreso..."
              className={styles.searchInput}
              autoFocus
            />
            <button type="submit" className={styles.searchButton}>Search</button>
          </form>

          <div className={styles.recommendationRow}>
            <span className={styles.recommendationLabel}>Recommendations</span>
            <div className={styles.recommendationChips}>
              {recommendations.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={styles.recommendationChip}
                  onClick={() => setSearchInput(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.meta}>
            {normalizedSearch ? (
              <span>
                Showing results for <strong>{normalizedSearch}</strong> • {totalResults} matches
              </span>
            ) : (
              <span>Type any keyword to search the full app data.</span>
            )}
          </div>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}

        {loading ? <div className={styles.state}>Loading results...</div> : null}

        {!loading && normalizedSearch && totalResults === 0 ? (
          <div className={styles.state}>No results found. Try another keyword.</div>
        ) : null}

        {!loading && totalResults > 0 ? (
          <div className={styles.grid}>
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>Notes</h2>
              {payload.notes.length === 0 ? <p className={styles.empty}>No note matches.</p> : null}
              {payload.notes.map((note) => (
                <Link key={note.id} href={`/note/${note.id}`} className={styles.item}>
                  <span className={styles.itemTitle}>{note.title}</span>
                  <span className={styles.itemMeta}>{note.category} • {formatDate(note.createdAt)}</span>
                </Link>
              ))}
            </section>

            <section className={styles.block}>
              <h2 className={styles.blockTitle}>Videos</h2>
              {payload.videos.length === 0 ? <p className={styles.empty}>No video matches.</p> : null}
              {payload.videos.map((video) => (
                <Link key={video.id} href={`/videos/${video.id}`} className={styles.item}>
                  <span className={styles.itemTitle}>{video.title}</span>
                  <span className={styles.itemMeta}>{video.category} • {formatDate(video.createdAt)}</span>
                </Link>
              ))}
            </section>

            <section className={styles.block}>
              <h2 className={styles.blockTitle}>Categories</h2>
              {payload.categories.length === 0 ? <p className={styles.empty}>No category matches.</p> : null}
              {payload.categories.map((category) => (
                <Link key={category.id} href={`/browse?category=${encodeURIComponent(category.slug)}`} className={styles.item}>
                  <span className={styles.itemTitle}>{category.name}</span>
                  <span className={styles.itemMeta}>{category.noteCount} notes</span>
                </Link>
              ))}
            </section>

            <section className={styles.block}>
              <h2 className={styles.blockTitle}>Tracks</h2>
              {payload.tracks.length === 0 ? <p className={styles.empty}>No track matches.</p> : null}
              {payload.tracks.map((track) => (
                <Link key={track.id} href={`/tracks/library?track=${encodeURIComponent(track.slug)}`} className={styles.item}>
                  <span className={styles.itemTitle}>{track.name}</span>
                  <span className={styles.itemMeta}>{track.approvedCount} resources</span>
                </Link>
              ))}
            </section>

            <section className={styles.blockWide}>
              <h2 className={styles.blockTitle}>Advanced Resources</h2>
              {payload.resources.length === 0 ? <p className={styles.empty}>No advanced resource matches.</p> : null}
              {payload.resources.map((resource) => (
                <Link
                  key={resource.id}
                  href={`/tracks/notes?track=${encodeURIComponent(resource.trackSlug)}&q=${encodeURIComponent(resource.title)}`}
                  className={styles.item}
                >
                  <span className={styles.itemTitle}>{resource.title}</span>
                  <span className={styles.itemMeta}>
                    {resource.trackName}
                    {resource.topicName ? ` • ${resource.topicName}` : ""}
                    {resource.createdAt ? ` • ${formatDate(resource.createdAt)}` : ""}
                  </span>
                </Link>
              ))}
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
