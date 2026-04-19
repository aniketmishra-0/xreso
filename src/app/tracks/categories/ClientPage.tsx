"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getTechIcon } from "@/lib/techIcons";
import styles from "@/app/categories/page.module.css";

export default function TracksCategoriesClient({
  tracks,
}: {
  tracks: { slug: string; name: string; description: string; resourceCount: number }[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.slug.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q)
    );
  }, [search, tracks]);

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        {/* Header + Search */}
        <div className={styles.header}>
          <h1 className={styles.title}>All Advanced Tracks</h1>
          <p className={styles.subtitle}>
            Browse our complete collection of production-grade systems architecture, DevOps, and cloud engineering tracks.
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
              placeholder="Search tracks… (e.g. Kubernetes, Ansible, Networking)"
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
            const resourceLabel = `${cat.resourceCount} resource${cat.resourceCount === 1 ? "" : "s"}`;
            return (
              <Link
                key={cat.slug}
                href={`/tracks/notes?track=${cat.slug}`}
                className={styles.card}
                id={`category-${cat.slug}`}
              >
                <div className={styles.iconWrap} style={{ background: bg }}>
                  <Icon size={28} color={color} />
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardName}>{cat.name}</h3>
                  <p className={styles.cardDesc}>{cat.description}</p>
                  <div className={styles.cardMetaRow}>
                    <span className={styles.cardMetaCount}>{resourceLabel}</span>
                    {cat.resourceCount === 0 ? (
                      <span className={styles.comingSoonBadge}>Coming Soon</span>
                    ) : null}
                  </div>
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
            <p>No tracks match &ldquo;{search}&rdquo;</p>
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
          Showing {filtered.length} of {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
        </div>
      </div>
    </section>
  );
}
