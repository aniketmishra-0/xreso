"use client";

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { CATEGORY_CATALOG } from "@/lib/techIcons";
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
  tags?: string[];
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





const SAVED_VIDEO_STORAGE_KEY = "xreso.savedVideoIds";

/* Quick-access tabs — same as Programming mode */
const QUICK_TABS = [
  "All", "Python", "JavaScript", "SQL", "Java",
  "Data Structures", "Web Dev", "C / C++",
];

const VIDEO_EXTRA_CATEGORIES = [
  { slug: "kubernetes", name: "Kubernetes" },
  { slug: "devops", name: "DevOps" },
  { slug: "system-design", name: "System Design" },
  { slug: "cloud-computing", name: "Cloud Computing" },
  { slug: "machine-learning", name: "Machine Learning" },
  { slug: "cybersecurity", name: "Cybersecurity" },
  { slug: "ai", name: "AI" },
  { slug: "api", name: "API" },
];

const ALL_CATEGORIES = CATEGORY_CATALOG
  .filter((cat) => cat.slug !== "devops")
  .map((cat) => ({
    slug: cat.slug,
    name: cat.name,
  }))
  .concat(VIDEO_EXTRA_CATEGORIES)
  .filter((cat, index, arr) => arr.findIndex((entry) => entry.slug === cat.slug) === index);

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "views", label: "Most Viewed" },
  { value: "saved", label: "Most Saved" },
];

function normalizeCategory(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s*\/\s*/g, "-")
    .replace(/\s+/g, "-");
}

function getDisplayAuthor(author: string | undefined): string {
  const normalized = (author || "").trim();
  if (!normalized || normalized.toLowerCase() === "anonymous") {
    return "Xreso Member";
  }
  return normalized;
}

function VideoPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("All");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });

  const page = parseInt(searchParams.get("page") || "1");
  const searchQuery = searchParams.get("search") || "";
  const activeVideoId = searchParams.get("video") || "";
  const sortBy =
    (searchParams.get("sort") as "newest" | "views" | "saved") || "newest";
  const selectedLanguageSlug =
    activeCategory === "All"
      ? ""
      : ALL_CATEGORIES.find((c) => c.name === activeCategory)?.slug || "";
  const selectedLanguageLabel =
    activeCategory === "All"
      ? "All Languages"
      : ALL_CATEGORIES.find((c) => c.slug === selectedLanguageSlug)?.name || "All Languages";
  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label || "Newest First";

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

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const filteredVideos = useMemo(() => {
    let list = videos;

    // Category filter - same as Programming mode
    if (activeCategory !== "All") {
      const categorySlug = normalizeCategory(activeCategory);
      list = list.filter((video) => {
        const videoCategory = normalizeCategory(video.category || "");
        const videoCategorySlug = normalizeCategory(video.categorySlug || "");
        const videoTags = (video.tags || []).map((t: string) => normalizeCategory(t));
        return (
          videoCategory.includes(categorySlug) ||
          videoCategorySlug.includes(categorySlug) ||
          videoTags.some((tag: string) => tag.includes(categorySlug))
        );
      });
    }

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

        <div className={styles.headerSearchWrap}>
          <div className={styles.searchControl}>
            <input
              id="video-search"
              type="search"
              value={searchInput}
              placeholder="Search by topic, stack, language, or concept..."
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
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterLeft}>
          <div className={styles.categoryTabs}>
            {QUICK_TABS.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`${styles.categoryTab} ${activeCategory === category ? styles.categoryTabActive : ""}`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className={styles.langDropdownWrap} ref={langDropdownRef}>
            <button
              type="button"
              className={styles.langDropdown}
              onClick={() => setLangMenuOpen((current) => !current)}
              aria-haspopup="listbox"
              aria-expanded={langMenuOpen}
              id="video-language-dropdown"
            >
              <span className={styles.langDropdownLabel}>{selectedLanguageLabel}</span>
            </button>

            {langMenuOpen && (
              <div className={styles.langMenu} role="listbox" aria-label="Language filter options">
                <button
                  type="button"
                  className={`${styles.langMenuItem} ${!selectedLanguageSlug ? styles.langMenuItemActive : ""}`}
                  onClick={() => {
                    setActiveCategory("All");
                    setLangMenuOpen(false);
                  }}
                >
                  All Languages
                </button>
                {ALL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    className={`${styles.langMenuItem} ${selectedLanguageSlug === cat.slug ? styles.langMenuItemActive : ""}`}
                    onClick={() => {
                      setActiveCategory(cat.name);
                      setLangMenuOpen(false);
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.sortDropdownWrap} ref={sortDropdownRef}>
          <button
            type="button"
            className={styles.sortDropdown}
            onClick={() => setSortMenuOpen((current) => !current)}
            aria-haspopup="listbox"
            aria-expanded={sortMenuOpen}
            id="video-sort-dropdown"
          >
            <span className={styles.sortDropdownLabel}>{activeSortLabel}</span>
          </button>

          {sortMenuOpen && (
            <div className={styles.sortMenu} role="listbox" aria-label="Sort options">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.sortMenuItem} ${sortBy === opt.value ? styles.sortMenuItemActive : ""}`}
                  onClick={() => {
                    updateQueryParams({ sort: opt.value });
                    setSortMenuOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
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
