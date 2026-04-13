"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getTechIcon, CATEGORY_CATALOG } from "@/lib/techIcons";
import styles from "./page.module.css";

export default function CategoriesPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return CATEGORY_CATALOG;
    const q = search.toLowerCase();
    return CATEGORY_CATALOG.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.slug.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        {/* Header + Search */}
        <div className={styles.header}>
          <h1 className={styles.title}>All Categories</h1>
          <p className={styles.subtitle}>
            Browse our complete collection of programming languages, frameworks,
            and CS topics
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
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search categories… (e.g. Python, Algorithms, Rust)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="category-search"
            />
            {search && (
              <button
                className={styles.searchClear}
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className={styles.grid}>
          {filtered.map((cat) => {
            const { Icon, color, bg } = getTechIcon(cat.slug);
            return (
              <Link
                key={cat.slug}
                href={`/browse?category=${cat.slug}`}
                className={styles.card}
                id={`category-${cat.slug}`}
              >
                <div className={styles.iconWrap} style={{ background: bg }}>
                  <Icon size={28} color={color} />
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardName}>{cat.name}</h3>
                  <p className={styles.cardDesc}>{cat.description}</p>
                </div>
                <div className={styles.cardArrow}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
                <div
                  className={styles.cardGlow}
                  style={{ background: color }}
                />
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p>No categories match &ldquo;{search}&rdquo;</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSearch("")}
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Count badge */}
        <div className={styles.countBadge}>
          Showing {filtered.length} of {CATEGORY_CATALOG.length} categories
        </div>
      </div>
    </section>
  );
}
