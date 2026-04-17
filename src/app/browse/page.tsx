"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORY_CATALOG } from "@/lib/techIcons";
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

/* Quick-access tabs — top 8 popular categories */
const QUICK_TABS = [
  "All", "Python", "JavaScript", "SQL", "Java",
  "Data Structures", "Web Dev", "C / C++",
];

/* Full list derived from CATEGORY_CATALOG for the dropdown (excluding DevOps as it's in Advanced) */
const ALL_CATEGORIES = CATEGORY_CATALOG
  .filter(cat => cat.slug !== "devops")
  .map(cat => ({
    slug: cat.slug,
    name: cat.name,
  }));

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
  const initialFeatured = searchParams.get("featured") === "true";
  const initialQueryParam = searchParams.get("q") || "";

  const [featuredOnly, setFeaturedOnly] = useState(initialFeatured);

  const [searchQuery, setSearchQuery] = useState(initialQueryParam);
  const [activeCategory, setActiveCategory] = useState(() => {
    if (initialCategoryParam) {
      // Check quick tabs first
      const tabMatch = QUICK_TABS.find(c =>
        c.toLowerCase().replace(/\s+/g, "-").replace("/", "-") === initialCategoryParam
        || c.toLowerCase() === initialCategoryParam
      );
      if (tabMatch) return tabMatch;
      // Check full catalog
      const catMatch = ALL_CATEGORIES.find(c => c.slug === initialCategoryParam);
      if (catMatch) return catMatch.name;
    }
    return "All";
  });
  const [sortBy, setSortBy] = useState("newest");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const catDropdownRef = useRef<HTMLDivElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const langDropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedLanguageSlug =
    activeCategory === "All"
      ? ""
      : ALL_CATEGORIES.find((c) => c.name === activeCategory)?.slug || "";
  const selectedLanguageLabel =
    activeCategory === "All"
      ? "All Languages"
      : ALL_CATEGORIES.find((c) => c.slug === selectedLanguageSlug)?.name || "All Languages";
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortBy)?.label || "Newest First";
  const latestResultDate = notes[0] ? formatDate(notes[0].createdAt) : "No notes yet";
  const focusAreaLabel = featuredOnly
    ? "Featured only"
    : activeCategory === "All"
      ? "All categories"
      : activeCategory;

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
      if (featuredOnly) {
        params.set("featured", "true");
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
  }, [searchQuery, activeCategory, sortBy, featuredOnly]);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const featured = searchParams.get("featured") === "true";
    const categoryParam = searchParams.get("category");

    setSearchQuery(q);
    setFeaturedOnly(featured);

    if (!categoryParam) {
      setActiveCategory("All");
      return;
    }

    const tabMatch = QUICK_TABS.find(
      (c) =>
        c.toLowerCase().replace(/\s+/g, "-").replace("/", "-") === categoryParam ||
        c.toLowerCase() === categoryParam
    );
    if (tabMatch) {
      setActiveCategory(tabMatch);
      return;
    }

    const catMatch = ALL_CATEGORIES.find((c) => c.slug === categoryParam);
    setActiveCategory(catMatch?.name || "All");
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(fetchNotes, 300); // debounce search
    return () => clearTimeout(timer);
  }, [fetchNotes]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (catDropdownRef.current && !catDropdownRef.current.contains(event.target as Node)) {
        setCatMenuOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerBg} />
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{featuredOnly ? "Curated Notes" : "Browse Notes"}</h1>
          <p className={styles.subtitle}>
            {featuredOnly
              ? "Handpicked featured notes selected by our moderators"
              : "Discover handwritten programming notes from our community"
            }
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
              placeholder="Universal search: title, tags, category, language, author, file name..."
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
          <div className={styles.filterLeft}>
            {/* Desktop: Category tabs (horizontal scroll) */}
            <div className={styles.categoryTabs}>
              {QUICK_TABS.map((cat) => (
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

            {/* Mobile: Category dropdown */}
            <div className={styles.mobileCatDropdownWrap} ref={catDropdownRef}>
              <button
                type="button"
                className={styles.mobileCatDropdown}
                onClick={() => setCatMenuOpen((current) => !current)}
                aria-haspopup="listbox"
                aria-expanded={catMenuOpen}
                id="category-dropdown"
              >
                <span className={styles.mobileCatDropdownLabel}>{activeCategory}</span>
              </button>

              {catMenuOpen && (
                <div className={styles.mobileCatMenu} role="listbox" aria-label="Category filter options">
                  {QUICK_TABS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.mobileCatMenuItem} ${activeCategory === cat ? styles.mobileCatMenuItemActive : ""}`}
                      onClick={() => {
                        setActiveCategory(cat);
                        setCatMenuOpen(false);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Language dropdown for ALL categories */}
            <div className={styles.langDropdownWrap} ref={langDropdownRef}>
              <button
                type="button"
                className={styles.langDropdown}
                onClick={() => setLangMenuOpen((current) => !current)}
                aria-haspopup="listbox"
                aria-expanded={langMenuOpen}
                id="language-dropdown"
              >
                <span className={styles.langDropdownLabel}>{selectedLanguageLabel}</span>
              </button>

              {/* Desktop dropdown */}
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

              {/* Mobile bottom sheet */}
              {langMenuOpen && (
                <>
                  <div className={styles.sheetOverlay} onClick={() => setLangMenuOpen(false)} />
                  <div className={styles.sheetPanel}>
                    <div className={styles.sheetHandle} />
                    <div className={styles.sheetHeader}>
                      <div>
                        <div className={styles.sheetLabel}>CHOOSE ONE</div>
                        <div className={styles.sheetTitle}>Programming Language / Topic</div>
                      </div>
                      <button className={styles.sheetClose} onClick={() => setLangMenuOpen(false)} aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                    <div className={styles.sheetOptions}>
                      <button
                        type="button"
                        className={`${styles.sheetOption} ${!selectedLanguageSlug ? styles.sheetOptionActive : ""}`}
                        onClick={() => { setActiveCategory("All"); setLangMenuOpen(false); }}
                      >
                        <span className={styles.sheetOptionText}>Select a programming topic</span>
                        {!selectedLanguageSlug && (
                          <svg className={styles.sheetOptionCheck} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </button>
                      {ALL_CATEGORIES.map((cat) => (
                        <button
                          key={cat.slug}
                          type="button"
                          className={`${styles.sheetOption} ${selectedLanguageSlug === cat.slug ? styles.sheetOptionActive : ""}`}
                          onClick={() => { setActiveCategory(cat.name); setLangMenuOpen(false); }}
                        >
                          <span className={styles.sheetOptionText}>{cat.name}</span>
                          {selectedLanguageSlug === cat.slug && (
                            <svg className={styles.sheetOptionCheck} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Custom Sort Dropdown */}
          <div className={styles.sortDropdownWrap} ref={sortDropdownRef}>
            <button
              type="button"
              className={styles.sortDropdown}
              onClick={() => setSortMenuOpen((current) => !current)}
              aria-haspopup="listbox"
              aria-expanded={sortMenuOpen}
              id="sort-dropdown"
            >
              <span className={styles.sortDropdownLabel}>{activeSortLabel}</span>
            </button>

            {/* Desktop dropdown */}
            {sortMenuOpen && (
              <div className={styles.sortMenu} role="listbox" aria-label="Sort options">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.sortMenuItem} ${sortBy === opt.value ? styles.sortMenuItemActive : ""}`}
                    onClick={() => {
                      setSortBy(opt.value);
                      setSortMenuOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Mobile bottom sheet for sort */}
            {sortMenuOpen && (
              <>
                <div className={styles.sheetOverlay} onClick={() => setSortMenuOpen(false)} />
                <div className={styles.sheetPanel}>
                  <div className={styles.sheetHandle} />
                  <div className={styles.sheetHeader}>
                    <div>
                      <div className={styles.sheetLabel}>SORT BY</div>
                      <div className={styles.sheetTitle}>Sort Order</div>
                    </div>
                    <button className={styles.sheetClose} onClick={() => setSortMenuOpen(false)} aria-label="Close">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                  <div className={styles.sheetOptions}>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${styles.sheetOption} ${sortBy === opt.value ? styles.sheetOptionActive : ""}`}
                        onClick={() => { setSortBy(opt.value); setSortMenuOpen(false); }}
                      >
                        <span className={styles.sheetOptionText}>{opt.label}</span>
                        {sortBy === opt.value && (
                          <svg className={styles.sheetOptionCheck} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.resultsShell}>
          <div className={styles.resultsSummary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Results</span>
              <span className={styles.summaryValue}>{loading ? "..." : total}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Latest addition</span>
              <span className={styles.summaryValue}>{loading ? "Loading..." : latestResultDate}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Focus area</span>
              <span className={styles.summaryValue}>{focusAreaLabel}</span>
            </div>
          </div>

          {/* Results Info */}
          <div className={styles.resultsInfo}>
            <span className={styles.resultsCount}>
              {loading ? "Loading..." : `${total} note${total !== 1 ? "s" : ""} found`}
            </span>
            <div className={styles.resultsActions}>
              <span className={styles.activeSortChip}>{activeSortLabel}</span>
              {activeCategory !== "All" && (
                <button
                  className={styles.clearFilter}
                  onClick={() => setActiveCategory("All")}
                >
                  Clear filter ×
                </button>
              )}
              {featuredOnly && (
                <button
                  className={styles.clearFilter}
                  onClick={() => setFeaturedOnly(false)}
                >
                  ★ Curated only ×
                </button>
              )}
            </div>
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
                  categorySlug={note.categorySlug}
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
