import Image from "next/image";
import Link from "next/link";
import {
  getTrendingNotes,
  getCategories,
  getLibraryHeroStats,
} from "@/lib/db/queries";
import { getTechIcon } from "@/lib/techIcons";
import HeroDigitalLibraryDashboard from "@/components/HeroDigitalLibraryDashboard";
import styles from "./page.module.css";

export const revalidate = 30;

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

const formatPublicStatValue = (value: number) => {
  if (value < 20) return "Growing";
  return formatCompactMetric(value);
};

const getSingularLabel = (value: number, singular: string, plural: string) =>
  value === 1 ? singular : plural;

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

/* ─── Page ─────────────────────────────────────────────────────────── */
export default async function Home() {
  const [trendingData, categories, heroStats] = await Promise.all([
    getTrendingNotes(6),
    getCategories(9),
    getLibraryHeroStats(),
  ]);

  const trendingNotes = trendingData.notes;
  const viewsThreshold = trendingData.threshold;
  const visibleCategories = categories.filter((category) => category.noteCount > 0);

  const stats = [
    {
      value: formatPublicStatValue(heroStats.notesIndexed),
      label: getSingularLabel(heroStats.notesIndexed, "Note Indexed", "Notes Indexed"),
    },
    {
      value: formatPublicStatValue(heroStats.activeLearners),
      label: getSingularLabel(heroStats.activeLearners, "Active Learner", "Active Learners"),
    },
    {
      value: formatPublicStatValue(heroStats.contributors),
      label: getSingularLabel(heroStats.contributors, "Contributor", "Contributors"),
    },
  ];

  const [primaryCategory] = visibleCategories;
  const totalCategoryNotes = visibleCategories.reduce((sum, category) => sum + category.noteCount, 0);
  const activeDomains = visibleCategories.length;
  const latestTrendingNote = trendingNotes[0];

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
              Handwritten programming notes by developers, for developers. Browse, save, and contribute for free.
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
            {visibleCategories.length > 0 ? (
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
                  {visibleCategories.map((cat, idx) => {
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

      {/* ══ TRENDING NOTES ═════════════════════════════════════════════ */}
      <section className={styles.section} id="featured-section">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Trending</p>
              <h2 className={styles.sectionTitle}>Curated Notes</h2>
              <p className={styles.sectionSubtitle}>
                Top trending notes — automatically surfaced from the community.
              </p>
            </div>
            <Link href="/browse?sort=popular" className="btn btn-secondary btn-sm">
              View all
            </Link>
          </div>

          <div className={styles.sectionShell}>
            {trendingNotes.length > 0 ? (
              <>
                <div className={styles.featuredSummary}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Trending now</span>
                    <span className={styles.summaryValue}>{trendingNotes.length}</span>
                  </div>

                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Top note</span>
                    <span className={styles.summaryValue}>
                      {latestTrendingNote
                        ? `${latestTrendingNote.viewCount.toLocaleString()} ${latestTrendingNote.viewCount === 1 ? "view" : "views"}`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div className={styles.featuredScroller}>
                  <div className={styles.featuredTrack}>
                  {trendingNotes.map((note) => {
                    const authorUrl = note.authorId ? `/user/${note.authorId}` : "#";

                    return (
                    <article key={note.id} className={styles.noteCard}>
                      <Link href={`/note/${note.id}`} className={styles.cardHitbox} aria-label={`View ${note.title}`} />
                      
                      <div className={styles.noteMedia}>
                        {(() => {
                          const isUsableThumbnail =
                            note.thumbnailUrl &&
                            !note.thumbnailUrl.includes("placeholder") &&
                            !note.thumbnailUrl.startsWith("/api/files/");
                          return isUsableThumbnail ? (
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
                          );
                        })()}
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
                          <span className={styles.noteMetric}>
                            {note.bookmarkCount} {note.bookmarkCount === 1 ? "save" : "saves"}
                          </span>
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
                          
                          <span className={styles.noteViews}>{note.viewCount} {note.viewCount === 1 ? "view" : "views"}</span>
                        </div>
                      </div>
                    </article>
                  )})}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.sectionEmpty}>
                <h3 className={styles.sectionEmptyTitle}>Trending notes will appear here</h3>
                <p className={styles.sectionEmptyText}>
                  Notes that cross {viewsThreshold.toLocaleString()} {viewsThreshold === 1 ? "view" : "views"} will automatically show up in this section.
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
