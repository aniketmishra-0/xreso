"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import VideoCard from "@/components/VideoCard/VideoCard";
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

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "popular", label: "Most Popular" },
];

function VideoPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const page = parseInt(searchParams.get("page") || "1");
  const searchQuery = searchParams.get("search") || "";
  const sortBy = (searchParams.get("sort") as "newest" | "popular") || "newest";

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const updateQueryParams = useCallback(
    (nextValues: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(nextValues).forEach(([key, value]) => {
        if (!value) {
          params.delete(key);
          return;
        }
        params.set(key, value);
      });

      params.set("page", "1");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

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
    } catch (err) {
      setError("Failed to load videos. Please try again.");
      console.error(err);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, sortBy]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

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
      </div>

      {/* Filters */}
      <div className={styles.controls}>
        <div className={styles.searchControl}>
          <label htmlFor="video-search">Search:</label>
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
      ) : videos.length === 0 ? (
        <div className={styles.empty}>
          <p>No videos found yet.</p>
        </div>
      ) : (
        <div className={styles.videoGrid}>
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              id={video.id}
              title={video.title}
              description={video.description}
              category={video.category}
              categorySlug={video.categorySlug}
              author={video.author}
              authorId={video.authorId}
              thumbnailUrl={video.thumbnailUrl}
              videoType={video.videoType}
              viewCount={video.viewCount}
              createdAt={video.createdAt}
            />
          ))}
        </div>
      )}
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
