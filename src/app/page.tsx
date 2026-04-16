import Image from "next/image";
import Link from "next/link";
import {
  getFeaturedNotes,
  getCategories,
  getLibraryHeroStats,
} from "@/lib/db/queries";
import { getTechIcon } from "@/lib/techIcons";
import HeroDigitalLibraryDashboard from "@/components/HeroDigitalLibraryDashboard";
import styles from "./page.module.css";

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

const formatNoteCount = (count: number) => `${count} note${count === 1 ? "" : "s"}`;

const formatCompactMetric = (value: number) => {
  if (value < 1000) {
    return value.toLocaleString("en-US");
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
};

/* ─── Sub-components ───────────────────────────────────────────────── */
function CategoryGlyph({
  slug,
  label,
  prominent = false,
}: {
  slug: string;
  label: string;
  prominent?: boolean;
}) {
  const { Icon, color, bg } = getTechIcon(slug);
  return (
    <div
      className={`${styles.categoryGlyph} ${prominent ? styles.categoryGlyphProminent : ""}`}
      style={{ background: bg, borderColor: `${color}40` }}
      aria-label={`${label} category`}
    >
      <Icon size={prominent ? 22 : 18} color={color} />
    </div>
  );
}

function NoteCategoryPill({
  category,
  slug,
}: {
  category: string;
  slug: string;
}) {
  const { Icon, color, bg } = getTechIcon(slug);

  return (
    <span
      className={styles.noteCategoryPill}
      style={{ background: bg, borderColor: `${color}33`, color }}
    >
      <Icon size={14} color={color} />
      {category}
    </span>
  );
}

/* ── Social Icons ── */
function GithubIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>; }
function LinkedInIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>; }
function TwitterIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>; }
function WebIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>; }

/* ─── Page ─────────────────────────────────────────────────────────── */
export default async function Home() {
  const [featuredNotes, categories, heroStats] = await Promise.all([
    getFeaturedNotes(6),
    getCategories(9),
    getLibraryHeroStats(),
  ]);

  const stats = [
    { value: formatCompactMetric(heroStats.notesIndexed), label: "Notes Indexed" },
    { value: formatCompactMetric(heroStats.activeLearners), label: "Active Learners" },
    { value: formatCompactMetric(heroStats.contributors), label: "Contributors" },
    { value: "99.9%", label: "Uptime" },
  ];

  const [primaryCategory] = categories;
  const totalCategoryNotes = categories.reduce((sum, category) => sum + category.noteCount, 0);
  const activeDomains = categories.filter((category) => category.noteCount > 0).length;
  const latestFeaturedNote = featuredNotes[0];

  return (
    <div className={styles.page}>

      {/* ══ HERO ══════════════════════════════════════════════════════ */}
      <section className={styles.hero} id="hero-section">
        {/* Background layers */}
        <div className={styles.heroBg} />
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />

        <div className={styles.heroInner}>
          {/* Left — copy */}
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              Knowledge Infrastructure and Programmer Library Engine
            </div>

            <h1 className={styles.heroTitle}>
              Programmer&apos;s Library
              <span className={styles.heroGradient}>
                {" "}for Modern Stack Builders
              </span>
            </h1>

            <p className={styles.heroSubtitle}>
              Navigate an immersive knowledge infrastructure where Rust, WebAssembly,
              cloud-native systems, and community activity flow through one living engine.
            </p>

            <div className={styles.heroActions}>
              <Link href="/browse" id="hero-browse-btn" className={`btn btn-primary btn-lg ${styles.heroCta}`}>
                Explore Library
                <span className={styles.arrow}>→</span>
              </Link>
              <Link href="/upload" id="hero-upload-btn" className={`btn btn-secondary btn-lg`}>
                Contribute Notes
              </Link>
            </div>

            {/* Search */}
            <form action="/browse" method="GET" className={styles.heroSearch}>
              <label htmlFor="hero-search" className="sr-only">Search notes</label>
              <input
                id="hero-search"
                name="q"
                type="text"
                placeholder="Search by topic, stack, language, or concept…"
                className={styles.heroSearchInput}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className={`btn btn-primary ${styles.heroSearchBtn}`}>
                Search
              </button>
            </form>

            {/* Stats */}
            <div className={styles.heroStats}>
              {stats.map((s) => (
                <div key={s.label} className={styles.statItem}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — digital library dashboard */}
          <div className={styles.heroRight}>
            <HeroDigitalLibraryDashboard />
          </div>
        </div>
      </section>

      {/* ══ CATEGORIES ════════════════════════════════════════════════ */}
      <section className={styles.section} id="categories-section">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Categories</p>
              <h2 className={styles.sectionTitle}>Explore by Domain</h2>
              <p className={styles.sectionSubtitle}>
                Start with the busiest domains, then drill into the full catalog without the visual clutter.
              </p>
            </div>
            <Link href="/categories" className="btn btn-secondary btn-sm">
              View all
            </Link>
          </div>

          <div className={styles.sectionShell}>
            {categories.length > 0 ? (
              <>
                <div className={styles.categorySummary}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Active domains</span>
                    <span className={styles.summaryValue}>{activeDomains}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Live notes indexed</span>
                    <span className={styles.summaryValue}>{totalCategoryNotes}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Start here</span>
                    <span className={styles.summaryValue}>{primaryCategory?.name ?? "Browse all"}</span>
                  </div>
                </div>

                <div className={styles.categoryGrid}>
                  {categories.map((cat, idx) => {
                    const isPrimary = primaryCategory?.slug === cat.slug;

                    return (
                      <Link
                        key={cat.slug}
                        href={`/browse?category=${cat.slug}`}
                        className={`${styles.categoryCard} ${
                          isPrimary ? styles.categoryCardPrimary : ""
                        } ${idx % 2 === 0 ? styles.categoryTintPurple : styles.categoryTintOrange}`}
                      >
                        <div className={styles.categoryCardTop}>
                          <CategoryGlyph
                            slug={cat.slug}
                            label={cat.name}
                            prominent={isPrimary}
                          />
                          <span className={styles.noteCount}>{formatNoteCount(cat.noteCount)}</span>
                        </div>

                        <div className={styles.categoryCardBody}>
                          {isPrimary ? (
                            <p className={styles.cardEyebrow}>Most active category</p>
                          ) : null}
                          <h3 className={styles.categoryCardTitle}>{cat.name}</h3>
                          <p className={styles.categoryCardDesc}>{cat.description}</p>
                        </div>

                        <div className={styles.categoryCardFooter}>
                          <span className={styles.categoryCardMeta}>
                            {isPrimary ? "Recommended start" : "Category library"}
                          </span>
                          <span className={styles.categoryCardLink}>Explore category →</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className={styles.sectionEmpty}>
                <h3 className={styles.sectionEmptyTitle}>No categories published yet</h3>
                <p className={styles.sectionEmptyText}>
                  Categories will appear here once the library is populated with approved notes.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ FEATURED NOTES ════════════════════════════════════════════ */}
      <section className={styles.section} id="featured-section">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Featured</p>
              <h2 className={styles.sectionTitle}>Curated Notes</h2>
              <p className={styles.sectionSubtitle}>
                High-signal picks from the community.
              </p>
            </div>
            <Link href="/browse?featured=true" className="btn btn-secondary btn-sm">
              View all
            </Link>
          </div>

          <div className={styles.sectionShell}>
            {featuredNotes.length > 0 ? (
              <>
                <div className={styles.featuredSummary}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Featured now</span>
                    <span className={styles.summaryValue}>{featuredNotes.length}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Latest addition</span>
                    <span className={styles.summaryValue}>
                      {latestFeaturedNote ? formatDate(latestFeaturedNote.createdAt) : "No notes yet"}
                    </span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Handpicked for</span>
                    <span className={styles.summaryValue}>Quality and clarity</span>
                  </div>
                </div>

                <div className={styles.featuredScroller}>
                  <div className={styles.featuredTrack}>
                  {featuredNotes.map((note) => {
                    const authorUrl = note.authorId ? `/user/${note.authorId}` : "#";

                    return (
                    <article key={note.id} className={styles.noteCard}>
                      <Link href={`/note/${note.id}`} className={styles.cardHitbox} aria-label={`View ${note.title}`} />
                      
                      <div className={styles.noteMedia}>
                        {note.thumbnailUrl && !note.thumbnailUrl.includes("placeholder") ? (
                          <Image
                            src={note.thumbnailUrl}
                            alt={note.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className={styles.noteMediaImage}
                          />
                        ) : (
                          <div
                            className={styles.noteMediaOg}
                            style={{
                              backgroundImage: `url(/api/og?title=${encodeURIComponent(note.title)}&category=${encodeURIComponent(note.category)}&v=3)`,
                            }}
                          />
                        )}
                      </div>

                      <div className={styles.noteCardContent}>
                        <div className={styles.noteCardTop}>
                          <NoteCategoryPill category={note.category} slug={note.categorySlug} />
                          <span className={styles.noteDate}>{formatDate(note.createdAt)}</span>
                        </div>
                        <h3 className={styles.noteTitle}>
                          <span>{note.title}</span>
                        </h3>
                        <p className={styles.noteDesc}>{note.description}</p>
                        <div className={styles.noteTags}>
                          {note.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className={styles.noteTag}>#{tag}</span>
                          ))}
                        </div>
                        <div className={styles.noteMetrics}>
                          <span className={styles.noteMetric}>{note.bookmarkCount} saves</span>
                          <span className={styles.noteMetric}>{note.tags.length} tags</span>
                        </div>
                        <div className={styles.noteFooter}>
                          <div className={styles.noteAuthorWrap}>
                            <Link href={authorUrl} className={styles.noteAuthorGroup}>
                              <span className={styles.noteAuthorAvatar} aria-hidden="true">
                                {note.author.charAt(0).toUpperCase()}
                              </span>
                              <span className={styles.noteAuthor}>{note.author}</span>
                            </Link>

                            {/* Hover Popover */}
                            <div className={styles.authorPopoverShell}>
                              <div className={styles.authorPopover}>
                                <div className={styles.popoverHeader}>
                                  <div className={styles.popoverAvatar}>{note.author.charAt(0).toUpperCase()}</div>
                                  <div className={styles.popoverInfo}>
                                    <p className={styles.popoverName}>{note.author}</p>
                                    <Link href={authorUrl} className={styles.popoverLink}>View Profile</Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <span className={styles.noteViews}>{note.viewCount} views</span>
                        </div>
                      </div>
                    </article>
                  )})}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.sectionEmpty}>
                <h3 className={styles.sectionEmptyTitle}>Featured notes will appear here</h3>
                <p className={styles.sectionEmptyText}>
                  As soon as moderators approve high-quality submissions, this section will spotlight them.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ CTA ═══════════════════════════════════════════════════════ */}
      <section className={styles.ctaSection} id="cta-section">
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaGlowLeft} />
            <div className={styles.ctaGlowRight} />
            <h2 className={styles.ctaTitle}>Got notes worth sharing?</h2>
            <p className={styles.ctaSubtitle}>
              Upload your handwritten programming notes and help thousands of developers learn.
              You keep your copyright — we amplify your reach.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/upload" id="cta-upload-btn" className="btn btn-primary btn-lg">
                Start Contributing
              </Link>
              <Link href="/terms" id="cta-learn-btn" className="btn btn-secondary btn-lg">
                Learn about our ToS
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
