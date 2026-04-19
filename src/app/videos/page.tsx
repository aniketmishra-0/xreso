"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import VideoCard from "@/components/VideoCard/VideoCard";
import { CATEGORY_CATALOG } from "@/lib/techIcons";
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

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_CATALOG.map((cat) => [cat.slug, cat.name])
);

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
  const [categories, setCategories] = useState<any[]>([]);

  const page = parseInt(searchParams.get("page") || "1");
  const categoryId = searchParams.get("categoryId") || "";
  const searchQuery = searchParams.get("search") || "";
  const sortBy = (searchParams.get("sort") as "newest" | "popular") || "newest";

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

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories?limit=50");
        const data = await response.json();
        const normalizedCategories = Array.isArray(data)
          ? data
          : Array.isArray(data?.categories)
            ? data.categories
            : [];
        setCategories(normalizedCategories);
      } catch (err) {
        console.error("Error fetching categories:", err);
        setCategories([]);
      }
    };

    fetchCategories();
  }, []);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "12");
      if (categoryId) params.set("categoryId", categoryId);
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
  }, [page, categoryId, searchQuery, sortBy]);

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
        <div className={styles.categoryControl}>
          <label htmlFor="category">Category:</label>
          <select
            id="category"
            value={categoryId}
            onChange={(event) => updateQueryParams({ categoryId: event.target.value })}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>
                {CATEGORY_LABELS[cat.slug] || cat.name}
              </option>
            ))}
          </select>
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
