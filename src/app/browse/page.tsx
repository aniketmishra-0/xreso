"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NoteCard from "@/components/NoteCard/NoteCard";
import styles from "./page.module.css";

interface Note {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  author: string;
  authorId?: string;
  authorGithub?: string;
  authorLinkedin?: string;
  authorTwitter?: string;
  authorWebsite?: string;
  thumbnailUrl: string;
  viewCount: number;
  bookmarkCount: number;
  tags: string[];
  createdAt: string;
}

const CATEGORIES = [
  "All", "Python", "JavaScript", "SQL", "Java",
  "Data Structures", "Web Dev", "C / C++", "DevOps",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "popular", label: "Most Popular" },
  { value: "bookmarked", label: "Most Bookmarked" },
];

const getCategoryColor = (slug: string) => {
  const map: Record<string, string> = {
    python: "python", javascript: "javascript", sql: "sql", java: "java",
  };
  return map[slug] || "default";
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

function BrowseContent() {
  const searchParams = useSearchParams();
  const initialCategoryParam = searchParams.get("category");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(() => {
    if (initialCategoryParam) {
      const match = CATEGORIES.find(c => 
        c.toLowerCase().replace(/\s+/g, "-").replace("/", "-") === initialCategoryParam
        || c.toLowerCase() === initialCategoryParam
      );
      return match || "All";
    }
    return "All";
  });
  const [sortBy, setSortBy] = useState("newest");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("sort", sortBy);
      params.set("limit", "20");
      if (activeCategory !== "All") {
        params.set("category", activeCategory.toLowerCase().replace(/\s+/g, "-").replace("/", "-"));
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }

      const res = await fetch(`/api/notes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch {
      console.error("Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeCategory, sortBy]);

  useEffect(() => {
    const timer = setTimeout(fetchNotes, 300); // debounce search
    return () => clearTimeout(timer);
  }, [fetchNotes]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerBg} />
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Browse Notes</h1>
          <p className={styles.subtitle}>
            Discover handwritten programming notes from our community
          </p>

          {/* Search Bar */}
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search notes by title, topic, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="browse-search-input"
            />
            {searchQuery && (
              <button
                className={styles.searchClear}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.categoryTabs}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`${styles.categoryTab} ${activeCategory === cat ? styles.active : ""}`}
                onClick={() => setActiveCategory(cat)}
                id={`filter-${cat.toLowerCase().replace(/[\s\/]+/g, "-")}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className={styles.sortWrap}>
            <label className={styles.sortLabel}>Sort by</label>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              id="sort-select"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Info */}
        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            {loading ? "Loading..." : `${total} note${total !== 1 ? "s" : ""} found`}
          </span>
          {activeCategory !== "All" && (
            <button
              className={styles.clearFilter}
              onClick={() => setActiveCategory("All")}
            >
              Clear filter ×
            </button>
          )}
        </div>

        {/* Notes Grid */}
        {loading ? (
          <div className={styles.loadingGrid}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className={styles.skeleton} />
            ))}
          </div>
        ) : notes.length > 0 ? (
          <div className={`${styles.notesGrid} stagger`}>
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                id={note.id}
                title={note.title}
                description={note.description}
                category={note.category}
                categoryColor={getCategoryColor(note.categorySlug)}
                author={note.author}
                authorId={note.authorId}
                authorGithub={note.authorGithub}
                authorLinkedin={note.authorLinkedin}
                authorTwitter={note.authorTwitter}
                authorWebsite={note.authorWebsite}
                thumbnailUrl={note.thumbnailUrl}
                viewCount={note.viewCount}
                bookmarkCount={note.bookmarkCount}
                tags={note.tags}
                createdAt={formatDate(note.createdAt)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📝</div>
            <h3 className={styles.emptyTitle}>No notes found</h3>
            <p className={styles.emptyDesc}>
              Try adjusting your search or filter to find what you&apos;re looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className={styles.page}>Loading browse...</div>}>
      <BrowseContent />
    </Suspense>
  );
}
