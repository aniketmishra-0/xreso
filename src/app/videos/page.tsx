"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import VideoCard from "@/components/VideoCard/VideoCard";
import VideoPlayer from "@/components/VideoPlayer/VideoPlayer";
import styles from "./page.module.css";

interface Video {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  author: string;
  authorId?: string;
  thumbnailUrl: string;
  videoType: string;
  videoId: string;
  viewCount: number;
  savedCount?: number;
  createdAt: string;
}

interface ListResponse {
  success: boolean;
  data: Video[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "views", label: "Most Viewed" },
  { value: "saved", label: "Most Saved" },
];

const CATEGORY_PILLS = [
  { value: "all", label: "All" },
  { value: "sql", label: "SQL" },
  { value: "linux", label: "Linux" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "devops", label: "DevOps" },
];

const SAVED_VIDEO_STORAGE_KEY = "xreso.savedVideoIds";

function getDisplayAuthor(author: string | undefined): string {
  const normalized = (author || "").trim();
  if (!normalized || normalized.toLowerCase() === "anonymous") {
    return "Xreso Member";
  }
  return normalized;
}

function VideoPageContent() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });

  const page = parseInt(searchParams.get("page") || "1");
  const searchQuery = searchParams.get("search") || "";
  const activeCategory = (searchParams.get("category") || "all").toLowerCase();
  const activeVideoId = searchParams.get("video") || "";
  const sortBy =
    (searchParams.get("sort") as "newest" | "views" | "saved") || "newest";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIDEO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      setSavedVideoIds(new Set(parsed));
    } catch {
      setSavedVideoIds(new Set());
    }
  }, []);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!activeVideo) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveVideo(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeVideo]);

  const updateQueryParams = useCallback(
    (nextValues: Record<string, string>, options?: { resetPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(nextValues).forEach(([key, value]) => {
        if (!value) {
          params.delete(key);
          return;
        }
        params.set(key, value);
      });

      if (options?.resetPage ?? true) {
        params.set("page", "1");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const toggleSavedVideo = useCallback((videoId: string) => {
    setSavedVideoIds((current) => {
      const next = new Set(current);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      window.localStorage.setItem(SAVED_VIDEO_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const openUploadPage = useCallback(() => {
    if (status === "unauthenticated") {
      const callbackUrl = encodeURIComponent("/upload");
      router.push(`/login?callbackUrl=${callbackUrl}&reason=upload_login_required`);
      return;
    }
    router.push("/upload");
  }, [router, status]);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "12");
      if (searchQuery) params.set("search", searchQuery);
      params.set("sort", sortBy);

      const response = await fetch(`/api/videos/list?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }

      const data: ListResponse = await response.json();
      setVideos(data.data || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      setError("Failed to load videos. Please try again.");
      console.error(err);
      setVideos([]);
      setPagination({ page: 1, limit: 12, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, sortBy]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    if (!activeVideoId) {
      setActiveVideo(null);
      return;
    }

    const fromGrid = videos.find((video) => video.id === activeVideoId);
    if (fromGrid) {
      setActiveVideo(fromGrid);
      return;
    }

    let cancelled = false;
    fetch(`/api/videos/${activeVideoId}`)
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { data?: Video };
        return payload.data || null;
      })
      .then((video) => {
        if (cancelled || !video) return;
        setActiveVideo(video);
      })
      .catch(() => {
        if (!cancelled) {
          updateQueryParams({ video: "" }, { resetPage: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeVideoId, videos, updateQueryParams]);

  const filteredVideos = useMemo(() => {
    const matchesCategory = (video: Video) => {
      if (!activeCategory || activeCategory === "all") return true;
      const slug = (video.categorySlug || "").toLowerCase();
      const label = (video.category || "").toLowerCase();
      return slug.includes(activeCategory) || label.includes(activeCategory);
    };

    const list = videos.filter(matchesCategory);

    if (sortBy === "saved") {
      return [...list].sort((a, b) => {
        const aSaved = savedVideoIds.has(a.id) ? 1 : 0;
        const bSaved = savedVideoIds.has(b.id) ? 1 : 0;
        if (aSaved !== bSaved) return bSaved - aSaved;
        const serverSavedA = a.savedCount || 0;
        const serverSavedB = b.savedCount || 0;
        if (serverSavedA !== serverSavedB) return serverSavedB - serverSavedA;
        return (b.viewCount || 0) - (a.viewCount || 0);
      });
    }

    return list;
  }, [activeCategory, savedVideoIds, sortBy, videos]);

  const activeVideoSavedTotal = activeVideo
    ? (activeVideo.savedCount || 0) + (savedVideoIds.has(activeVideo.id) ? 1 : 0)
    : 0;

  return (
    <div className={styles.videosPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>🎬 Video Library</h1>
          <p className={styles.subtitle}>
            Watch educational videos on programming, web development, and more
          </p>
        </div>
        <button type="button" className={styles.uploadBtn} onClick={openUploadPage}>
          Upload Video
        </button>
      </div>

      {/* Filters */}
      <div className={styles.controls}>
        <div className={styles.searchControl}>
          <input
            id="video-search"
            type="search"
            value={searchInput}
            placeholder="Search videos by title, description, or author"
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                updateQueryParams({ search: searchInput.trim() });
              }
            }}
          />
          <button
            type="button"
            className={styles.searchBtn}
            onClick={() => updateQueryParams({ search: searchInput.trim() })}
          >
            Search
          </button>
        </div>

        <div className={styles.filterPills}>
          {CATEGORY_PILLS.map((pill) => {
            const isActive = activeCategory === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                className={isActive ? styles.filterPillActive : styles.filterPill}
                onClick={() =>
                  updateQueryParams({
                    category: pill.value === "all" ? "" : pill.value,
                  })
                }
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div className={styles.sortControl}>
          <label htmlFor="sort">Sort by:</label>
          <select
            id="sort"
            value={sortBy}
            onChange={(event) => updateQueryParams({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className={styles.loading}>Loading videos...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : filteredVideos.length === 0 ? (
        <div className={styles.empty}>
          <p>No videos found yet.</p>
        </div>
      ) : (
        <div className={styles.videoGrid}>
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              id={video.id}
              title={video.title}
              description={video.description}
              category={video.category}
              categorySlug={video.categorySlug}
              author={getDisplayAuthor(video.author)}
              authorId={video.authorId}
              thumbnailUrl={video.thumbnailUrl}
              videoType={video.videoType}
              viewCount={video.viewCount}
              createdAt={video.createdAt}
              onOpen={() => {
                updateQueryParams({ video: video.id }, { resetPage: false });
                setVideos((current) =>
                  current.map((item) =>
                    item.id === video.id
                      ? { ...item, viewCount: item.viewCount + 1 }
                      : item
                  )
                );
                fetch(`/api/videos/${video.id}`).catch(() => {
                  // Best effort analytics update.
                });
              }}
            />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => updateQueryParams({ page: String(Math.max(1, page - 1)) }, { resetPage: false })}
            disabled={page <= 1}
          >
            Previous
          </button>

          <div className={styles.pageNumbers}>
            {Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
              .filter((pageNum) =>
                pageNum === 1 ||
                pageNum === pagination.totalPages ||
                Math.abs(pageNum - page) <= 1
              )
              .map((pageNum, index, arr) => {
                const prev = arr[index - 1];
                const showGap = prev && pageNum - prev > 1;
                return (
                  <span key={pageNum} className={styles.pageGroup}>
                    {showGap ? <span className={styles.pageGap}>…</span> : null}
                    <button
                      type="button"
                      className={pageNum === page ? styles.pageBtnActive : styles.pageBtnGhost}
                      onClick={() =>
                        updateQueryParams({ page: String(pageNum) }, { resetPage: false })
                      }
                    >
                      {pageNum}
                    </button>
                  </span>
                );
              })}
          </div>

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() =>
              updateQueryParams(
                { page: String(Math.min(pagination.totalPages, page + 1)) },
                { resetPage: false }
              )
            }
            disabled={page >= pagination.totalPages}
          >
            Next
          </button>
        </div>
      ) : null}

      {activeVideo ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={activeVideo.title}
          onClick={() => updateQueryParams({ video: "" }, { resetPage: false })}
        >
          <div className={styles.modalPanel} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              aria-label="Close video player"
              onClick={() => updateQueryParams({ video: "" }, { resetPage: false })}
            >
              ×
            </button>

            <VideoPlayer
              videoId={activeVideo.videoId}
              videoType={activeVideo.videoType as "youtube" | "vimeo" | "drive" | "onedrive"}
              title={activeVideo.title}
            />

            <div className={styles.modalMetaRow}>
              <div className={styles.modalInfo}>
                <h2 className={styles.modalTitle}>{activeVideo.title}</h2>
                <p className={styles.modalAuthor}>By {getDisplayAuthor(activeVideo.author)}</p>
              </div>

              <div className={styles.modalActions}>
                <span className={styles.modalViews}>
                  👁️ {activeVideo.viewCount.toLocaleString()} {activeVideo.viewCount === 1 ? "view" : "views"}
                </span>
                <button
                  type="button"
                  className={savedVideoIds.has(activeVideo.id) ? styles.saveBtnActive : styles.saveBtn}
                  onClick={() => toggleSavedVideo(activeVideo.id)}
                >
                  {savedVideoIds.has(activeVideo.id) ? "Saved" : "Save"}
                  <span className={styles.saveCount}>{activeVideoSavedTotal.toLocaleString()}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function VideosPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VideoPageContent />
    </Suspense>
  );
}
