"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

interface AdvancedTrackTopic {
  id: number;
  slug: string;
  name: string;
  description: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

interface AdvancedTrack {
  id: number;
  slug: string;
  name: string;
  description: string;
  premium: boolean;
  approvedCount: number;
  topics: AdvancedTrackTopic[];
}

type TrackFilter = "all" | string;

function TracksPageContent() {
  const searchParams = useSearchParams();

  const [tracks, setTracks] = useState<AdvancedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");

  const activeTrack = useMemo<TrackFilter>(() => {
    const trackParam = searchParams.get("track");
    return trackParam || "all";
  }, [searchParams]);

  const loadTracks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/advanced-tracks", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load advanced tracks");
      }

      const payload = (await response.json()) as { tracks?: AdvancedTrack[] };
      setTracks(payload.tracks || []);
    } catch {
      setError("Could not load advanced tracks right now.");
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  const buildTrackHref = (nextTrack: TrackFilter) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextTrack === "all") {
      params.delete("track");
    } else {
      params.set("track", nextTrack);
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    } else {
      params.delete("q");
    }

    const queryString = params.toString();
    return queryString ? `/tracks/library?${queryString}` : "/tracks/library";
  };

  const normalizedQuery = query.trim().toLowerCase();

  const visibleTracks = useMemo(() => {
    return tracks
      .filter((track) => activeTrack === "all" || track.slug === activeTrack)
      .map((track) => {
        if (!normalizedQuery) {
          return {
            ...track,
            visibleTopics: track.topics,
          };
        }

        const searchableTrackText = [track.name, track.description].join(" ").toLowerCase();

        const visibleTopics = searchableTrackText.includes(normalizedQuery)
          ? track.topics
          : track.topics.filter((topic) => {
              const searchableTopicText = [topic.name, topic.description, topic.level]
                .join(" ")
                .toLowerCase();
              return searchableTopicText.includes(normalizedQuery);
            });

        return {
          ...track,
          visibleTopics,
        };
      })
      .filter((track) => track.visibleTopics.length > 0 || normalizedQuery.length === 0);
  }, [activeTrack, normalizedQuery, tracks]);

  const trackFilters: Array<{ value: TrackFilter; label: string }> = [
    { value: "all", label: "All Tracks" },
    ...tracks.map((track) => ({ value: track.slug, label: track.name })),
  ];

  return (
    <section className={styles.page} id="cloud-native-library-page">
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Advanced Tracks</h1>
          <p className={styles.subtitle}>
            Discover advanced learning tracks for Kubernetes, DevOps, and system design
          </p>

          <div className={styles.searchWrap}>
            <svg
              className={styles.searchIcon}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={styles.searchInput}
              id="track-search-input"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search topics like Linux, Ansible, observability"
            />
            {query ? (
              <button
                className={styles.searchClear}
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                x
              </button>
            ) : null}
          </div>

          <div className={styles.trackTabs} role="tablist" aria-label="Track filters">
            {trackFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (filter.value === "all") {
                    params.delete("track");
                  } else {
                    params.set("track", filter.value);
                  }
                  window.history.replaceState(null, "", `/tracks/library?${params.toString()}`);
                }}
                role="tab"
                aria-selected={activeTrack === filter.value}
                className={`${styles.trackTab} ${
                  activeTrack === filter.value ? styles.trackTabActive : ""
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        {error ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Could not load advanced tracks</h2>
            <p className={styles.emptyText}>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => void loadTracks()}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Loading advanced tracks...</h2>
          </div>
        ) : visibleTracks.length === 0 ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>No matching topic found</h2>
            <p className={styles.emptyText}>Try another keyword or reset filters.</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuery("")}>
              Reset Search
            </button>
          </div>
        ) : (
          <div className={styles.trackGrid}>
            {visibleTracks.map((track) => (
              <Link
                key={track.slug}
                href={`/tracks/notes?track=${track.slug}`}
                className={styles.trackCard}
              >
                <div className={styles.trackCardHeader}>
                  <h2 className={styles.trackName}>{track.name}</h2>
                  <span className={styles.topicCount}>{track.approvedCount} resources</span>
                </div>
                <p className={styles.trackDescription}>{track.description}</p>
                <div className={styles.trackTopics}>
                  {track.visibleTopics.slice(0, 3).map((topic) => (
                    <span key={topic.slug} className={styles.topicTag}>
                      {topic.name}
                    </span>
                  ))}
                  {track.visibleTopics.length > 3 && (
                    <span className={styles.topicTag}>+{track.visibleTopics.length - 3} more</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TracksPageFallback() {
  return (
    <section className={styles.page}>
      <div className={styles.container} aria-busy="true" style={{ minHeight: 560 }} />
    </section>
  );
}

export default function TracksPage() {
  return (
    <Suspense fallback={<TracksPageFallback />}>
      <TracksPageContent />
    </Suspense>
  );
}
