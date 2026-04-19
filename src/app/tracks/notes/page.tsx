"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import UnifiedDropdown from "@/components/UnifiedDropdown/UnifiedDropdown";
import NoteCard from "@/components/NoteCard/NoteCard";
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

interface AdvancedResource {
  id: string;
  title: string;
  summary: string;
  resourceType: "link" | "pdf" | "doc" | "video";
  contentUrl: string | null;
  accessLocked: boolean;
  thumbnailUrl: string | null;
  premiumOnly: boolean;
  featured: boolean;
  status: string;
  viewCount: number;
  saveCount: number;
  createdAt: string;
  trackSlug: string;
  trackName: string;
  topicSlug: string | null;
  topicName: string | null;
  authorId: string;
  authorName: string;
  tags: string[];
}

type SortValue = "newest" | "popular" | "featured";

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "Newest First" },
  { value: "popular", label: "Most Popular" },
  { value: "featured", label: "Featured First" },
];

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

function TrackNotesContent() {
  const searchParams = useSearchParams();

  const [tracks, setTracks] = useState<AdvancedTrack[]>([]);
  const [resources, setResources] = useState<AdvancedResource[]>([]);
  const [viewer, setViewer] = useState({
    isAuthenticated: false,
    hasPremiumAccess: false,
  });
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [sortBy, setSortBy] = useState<SortValue>("newest");

  const selectedTrackSlug = searchParams.get("track") ?? "";
  const selectedTopicSlug = searchParams.get("topic") ?? "";

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.slug === selectedTrackSlug) || null,
    [tracks, selectedTrackSlug]
  );

  const selectedTopic = useMemo(() => {
    if (!selectedTrack) return null;
    if (!selectedTopicSlug) return null;
    return selectedTrack.topics.find((topic) => topic.slug === selectedTopicSlug) || null;
  }, [selectedTopicSlug, selectedTrack]);

  const fetchTracks = useCallback(async () => {
    setLoadingTracks(true);
    setError(null);

    try {
      const response = await fetch("/api/advanced-tracks", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch tracks");
      }

      const data = (await response.json()) as { tracks?: AdvancedTrack[] };
      setTracks(data.tracks || []);
    } catch {
      setError("Could not load advanced tracks.");
      setTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("sort", sortBy);
      params.set("limit", "20");

      if (selectedTrackSlug) {
        params.set("track", selectedTrackSlug);
      }

      if (selectedTopicSlug) {
        params.set("topic", selectedTopicSlug);
      }

      const normalizedQuery = searchQuery.trim();
      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }

      const response = await fetch(`/api/advanced-tracks/resources?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch resources");
      }

      const data = (await response.json()) as {
        resources?: AdvancedResource[];
        viewer?: {
          isAuthenticated?: boolean;
          hasPremiumAccess?: boolean;
        };
        pagination?: { total?: number };
      };

      setResources(data.resources || []);
      setViewer({
        isAuthenticated: Boolean(data.viewer?.isAuthenticated),
        hasPremiumAccess: Boolean(data.viewer?.hasPremiumAccess),
      });
      setTotal(data.pagination?.total || 0);
    } catch {
      setError("Could not load advanced resources.");
      setResources([]);
      setViewer({ isAuthenticated: false, hasPremiumAccess: false });
      setTotal(0);
    } finally {
      setLoadingResources(false);
    }
  }, [searchQuery, selectedTopicSlug, selectedTrackSlug, sortBy]);

  useEffect(() => {
    void fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchResources();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchResources]);

  const latestResultDate = resources[0] ? formatDate(resources[0].createdAt) : "No resources yet";
  const lockedResourceCount = useMemo(
    () => resources.filter((resource) => resource.accessLocked).length,
    [resources]
  );
  const unlockHref = useMemo(() => {
    const callbackPath =
      searchParams.toString().length > 0
        ? `/tracks/notes?${searchParams.toString()}`
        : "/tracks/notes";

    return `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
  }, [searchParams]);

  const buildTrackHref = (trackSlug?: string) => {
    const params = new URLSearchParams();
    if (trackSlug) {
      params.set("track", trackSlug);
    }

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    const queryString = params.toString();
    return queryString ? `/tracks/notes?${queryString}` : "/tracks/notes";
  };

  const buildTopicHref = (topicSlug?: string) => {
    if (!selectedTrack) return "/tracks/library";

    const params = new URLSearchParams();
    params.set("track", selectedTrack.slug);

    if (topicSlug) {
      params.set("topic", topicSlug);
    }

    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    return `/tracks/notes?${params.toString()}`;
  };

  const trackFilters: Array<{ slug: string; label: string }> = [
    { slug: "", label: "All" },
    ...tracks.map((track) => ({ slug: track.slug, label: track.name })),
  ];

  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label || "Newest First";
  const focusAreaLabel = selectedTopic
    ? `Topic: ${selectedTopic.name}`
    : selectedTrack
      ? `Track: ${selectedTrack.name}`
      : "All tracks";
  const isLoading = loadingTracks || loadingResources;

  return (
    <section className={styles.page} id="advanced-track-notes-page">
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Browse Advanced Notes</h1>
          <p className={styles.subtitle}>
            Discover production-focused notes across Kubernetes, Linux, DevOps, and System Design.
          </p>

          <div className={styles.controls}>
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
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search inside the open tracks library"
              />
              {searchQuery ? (
                <button
                  className={styles.searchClear}
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  x
                </button>
              ) : null}
            </div>

            <div className={styles.sortWrap}>
              <label className={styles.sortLabel} htmlFor="advanced-sort-select">
                Sort by
              </label>
              <UnifiedDropdown
                className={styles.sortSelectWrap}
                desktopClassName={styles.sortSelect}
                id="advanced-sort-select"
                title="Sort Advanced Notes"
                placeholder="Sort by"
                options={SORT_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                value={sortBy}
                onChange={(nextSort) => setSortBy(nextSort as SortValue)}
              />
            </div>
          </div>
        </header>

        <div className={styles.tabsSection}>
          <div className={styles.trackTabs}>
            {trackFilters.map((track) => {
              const isAll = track.slug.length === 0;
              const isActive = isAll
                ? !selectedTrackSlug
                : selectedTrack?.slug === track.slug;

              return (
                <Link
                  key={isAll ? "all-tracks" : track.slug}
                  href={buildTrackHref(track.slug || undefined)}
                  replace
                  scroll={false}
                  className={`${styles.trackTab} ${isActive ? styles.trackTabActive : ""}`}
                >
                  {track.label}
                </Link>
              );
            })}
          </div>

          {selectedTrack ? (
            <div className={styles.topicTabs}>
              <Link
                href={buildTopicHref()}
                replace
                scroll={false}
                className={`${styles.topicTab} ${!selectedTopic ? styles.topicTabActive : ""}`}
              >
                All {selectedTrack.name}
              </Link>
              {selectedTrack.topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={buildTopicHref(topic.slug)}
                  replace
                  scroll={false}
                  className={`${styles.topicTab} ${
                    selectedTopic?.slug === topic.slug ? styles.topicTabActive : ""
                  }`}
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Results</p>
            <p className={styles.summaryValue}>{isLoading ? "..." : total}</p>
          </div>
          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Latest addition</p>
            <p className={styles.summaryValue}>{isLoading ? "Loading..." : latestResultDate}</p>
          </div>
          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Scope</p>
            <p className={styles.summaryValue}>{focusAreaLabel}</p>
          </div>
        </div>

        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            {isLoading ? "Loading..." : `${total} resource${total !== 1 ? "s" : ""} found`}
          </span>
          <div className={styles.resultsActions}>
            <span className={styles.activeSortChip}>{activeSortLabel}</span>
            {selectedTrack ? (
              <Link className={styles.clearFilter} href={buildTrackHref()} replace scroll={false}>
                Clear track ×
              </Link>
            ) : null}
            {selectedTopic && selectedTrack ? (
              <Link className={styles.clearFilter} href={buildTopicHref()} replace scroll={false}>
                Clear topic ×
              </Link>
            ) : null}
            {searchQuery ? (
              <button className={styles.clearFilter} onClick={() => setSearchQuery("")}>
                Clear search ×
              </button>
            ) : null}
          </div>
        </div>

        {lockedResourceCount > 0 && !viewer.hasPremiumAccess ? (
          <div className={styles.accessNotice}>
            <h2 className={styles.accessTitle}>Some resources need review access</h2>
            <p className={styles.accessText}>
              {viewer.isAuthenticated
                ? `${lockedResourceCount} resource links are still hidden for this account.`
                : `Sign in to check access for ${lockedResourceCount} resource links.`}
            </p>
            {!viewer.isAuthenticated ? (
              <Link href={unlockHref} className="btn btn-secondary btn-sm">
                Sign In
              </Link>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Could not load track resources</h2>
            <p className={styles.emptyText}>{error}</p>
          </div>
        ) : isLoading ? (
          <div className={styles.loadingGrid}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className={styles.skeleton} />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>No resources found</h2>
            <p className={styles.emptyText}>
              Try another topic, or clear the search keyword.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => setSearchQuery("")}>
              Clear Search
            </button>
          </div>
        ) : (
          <div className={styles.resourceGrid} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
            {resources.map((resource) => {
              // Determine href based on resource type
              const isExternalLink = resource.contentUrl?.startsWith("http") || resource.contentUrl?.startsWith("https");
              const isOneDrive = resource.contentUrl?.startsWith("onedrive://");
              
              // External links open directly, OneDrive/internal use resource API
              const cardHref = isExternalLink 
                ? resource.contentUrl 
                : isOneDrive
                  ? `/api/advanced-tracks/resource/${resource.id}`
                  : resource.contentUrl || `/api/advanced-tracks/resource/${resource.id}`;
              
              return (
                <NoteCard
                  key={resource.id}
                  id={resource.id}
                  title={resource.title}
                  description={resource.summary}
                  category={resource.trackName}
                  categorySlug={resource.trackSlug}
                  author={resource.authorName || "Unknown author"}
                  authorId={resource.authorId}
                  thumbnailUrl={resource.thumbnailUrl || ""}
                  viewCount={resource.viewCount}
                  bookmarkCount={resource.saveCount}
                  tags={[...resource.tags, resource.topicName].filter(Boolean) as string[]}
                  createdAt={formatDate(resource.createdAt)}
                  href={cardHref || undefined}
                  external={isExternalLink}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function TrackNotesFallback() {
  return (
    <section className={styles.page}>
      <div className={styles.container} aria-busy="true" style={{ minHeight: 560 }} />
    </section>
  );
}

export default function TrackNotesPage() {
  return (
    <Suspense fallback={<TrackNotesFallback />}>
      <TrackNotesContent />
    </Suspense>
  );
}
