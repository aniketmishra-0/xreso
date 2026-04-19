import Image from "next/image";
import Link from "next/link";
import {
  getAdvancedHeroStats,
  getAdvancedTrackHighlights,
  getFeaturedAdvancedResources,
} from "@/lib/db/queries";
import { getTechIcon } from "@/lib/techIcons";
import HeroDigitalLibraryDashboard from "@/components/HeroDigitalLibraryDashboard";
import styles from "../page.module.css";

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
export const revalidate = 30;

const formatResourceCount = (count: number) =>
  `${count} resource${count === 1 ? "" : "s"}`;

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
  if (value < 10) return "Growing";
  return formatCompactMetric(value);
};

const getSingularLabel = (value: number, singular: string, plural: string) =>
  value === 1 ? singular : plural;

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
      aria-label={`${label} track`}
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

export default async function TracksHomePage() {
  const [heroStats, advancedTracks, featuredResources] = await Promise.all([
    getAdvancedHeroStats(),
    getAdvancedTrackHighlights(9, 5),
    getFeaturedAdvancedResources(6),
  ]);
  const visibleTracks = advancedTracks.filter((track) => track.resourceCount > 0);

  const stats = [
    {
      value: formatPublicStatValue(heroStats.trackCount),
      label: getSingularLabel(heroStats.trackCount, "Track", "Tracks"),
    },
    {
      value: formatPublicStatValue(heroStats.topicCount),
      label: getSingularLabel(heroStats.topicCount, "Topic", "Topics"),
    },
    {
      value: formatPublicStatValue(heroStats.contributorCount),
      label: getSingularLabel(heroStats.contributorCount, "Contributor", "Contributors"),
    },
  ];

  const [primaryTrack] = visibleTracks;
  const totalTrackResources = visibleTracks.reduce(
    (sum, track) => sum + track.resourceCount,
    0
  );
  const latestFeaturedResource = featuredResources[0];

  const buildResourceHref = (resource: {
    id: string;
    trackSlug: string;
    topicSlug: string | null;
  }) => {
    return `/note/${resource.id}?mode=advanced`;
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero} id="hero-section">
        <div className={styles.heroBg} />
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />

        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              Advanced Cloud-Native and Systems Library
            </div>

            <h1 className={styles.heroTitle}>
              Advanced Engineer&apos;s Library
              <span className={styles.heroGradient}> for Production Systems</span>
            </h1>

            <p className={styles.heroSubtitle}>
              Deep tracks for Kubernetes, Linux, DevOps, and system design with curated
              resources for real-world architecture and operations.
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/tracks/library"
                id="hero-browse-btn"
                className={`btn btn-primary btn-lg ${styles.heroCta}`}
              >
                Explore Tracks
                <span className={styles.arrow}>→</span>
              </Link>
              <Link href="/tracks/notes" id="hero-upload-btn" className="btn btn-secondary btn-lg">
                Browse Advanced Notes
              </Link>
            </div>

            <form action="/tracks/library" method="GET" className={styles.heroSearch}>
              <label htmlFor="hero-search" className="sr-only">
                Search advanced tracks
              </label>
              <input
                id="hero-search"
                name="q"
                type="text"
                placeholder="Search Kubernetes, Linux, CI/CD, observability…"
                className={styles.heroSearchInput}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className={`btn btn-primary ${styles.heroSearchBtn}`}>
                Search
              </button>
            </form>

            <div className={styles.heroStats}>
              {stats.map((s) => (
                <div key={s.label} className={styles.statItem}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.heroRight}>
            <HeroDigitalLibraryDashboard mode="advanced" />
          </div>
        </div>
      </section>

      <section className={styles.section} id="tracks-section">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Tracks</p>
              <h2 className={styles.sectionTitle}>Explore by Track</h2>
              <p className={styles.sectionSubtitle}>
                Start with Kubernetes, DevOps, and system design tracks, then dive into topic-wise
                advanced notes.
              </p>
            </div>
            <Link href="/tracks/library" className="btn btn-secondary btn-sm">
              View all
            </Link>
          </div>

          <div className={styles.sectionShell}>
            {visibleTracks.length > 0 ? (
              <>
                <div className={styles.categorySummary}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>
                      Active {visibleTracks.length === 1 ? "track" : "tracks"}
                    </span>
                    <span className={styles.summaryValue}>{visibleTracks.length}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>
                      Approved {totalTrackResources === 1 ? "resource" : "resources"}
                    </span>
                    <span className={styles.summaryValue}>{totalTrackResources}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Start here</span>
                    <span className={styles.summaryValue}>{primaryTrack?.name ?? "Browse tracks"}</span>
                  </div>
                </div>

                <div className={styles.categoryGrid}>
                  {visibleTracks.map((track, idx) => {
                    const isPrimary = primaryTrack?.slug === track.slug;

                    return (
                      <Link
                        key={track.slug}
                        href={`/tracks/notes?track=${track.slug}`}
                        className={`${styles.categoryCard} ${
                          isPrimary ? styles.categoryCardPrimary : ""
                        } ${idx % 2 === 0 ? styles.categoryTintPurple : styles.categoryTintOrange}`}
                      >
                        <div className={styles.categoryCardTop}>
                          <CategoryGlyph slug={track.slug} label={track.name} prominent={isPrimary} />
                          <span className={styles.noteCount}>{formatResourceCount(track.resourceCount)}</span>
                        </div>

                        <div className={styles.categoryCardBody}>
                          {isPrimary ? (
                            <p className={styles.cardEyebrow}>Most active track</p>
                          ) : null}
                          <h3 className={styles.categoryCardTitle}>{track.name}</h3>
                          <p className={styles.categoryCardDesc}>{track.description}</p>

                          <div className={styles.noteTags}>
                            {track.topics.slice(0, 3).map((topic) => (
                              <span key={`${track.slug}-${topic.slug}`} className={styles.noteTag}>
                                {topic.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className={styles.categoryCardFooter}>
                          <span className={styles.categoryCardMeta}>
                            {isPrimary ? "Recommended start" : "Track library"}
                          </span>
                          <span className={styles.categoryCardLink}>Open track →</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className={styles.sectionEmpty}>
                <h3 className={styles.sectionEmptyTitle}>No advanced tracks published yet</h3>
                <p className={styles.sectionEmptyText}>
                  Tracks will appear here once published in the advanced tracks admin.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section} id="featured-section">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Featured</p>
              <h2 className={styles.sectionTitle}>Curated Advanced Resources</h2>
              <p className={styles.sectionSubtitle}>
                High-signal resources across Kubernetes, Linux internals, platform engineering,
                and distributed systems.
              </p>
            </div>
            <Link href="/tracks/notes" className="btn btn-secondary btn-sm">
              View all
            </Link>
          </div>

          <div className={styles.sectionShell}>
            {featuredResources.length > 0 ? (
              <>
                <div className={styles.featuredSummary}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Featured now</span>
                    <span className={styles.summaryValue}>{featuredResources.length}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Latest addition</span>
                    <span className={styles.summaryValue}>
                      {latestFeaturedResource
                        ? formatDate(latestFeaturedResource.createdAt)
                        : "No resources yet"}
                    </span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Top track</span>
                    <span className={styles.summaryValue}>{primaryTrack?.name ?? "Advanced"}</span>
                  </div>
                </div>

                <div className={styles.featuredScroller}>
                  <div className={styles.featuredTrack}>
                    {featuredResources.map((resource) => (
                      <article key={resource.id} className={styles.noteCard}>
                        <Link
                          href={buildResourceHref(resource)}
                          className={styles.cardHitbox}
                          aria-label={`View ${resource.title}`}
                        />

                        <div className={styles.noteMedia}>
                          {(() => {
                            const isUsableThumbnail =
                              resource.thumbnailUrl &&
                              !resource.thumbnailUrl.includes("placeholder") &&
                              !resource.thumbnailUrl.startsWith("/api/files/");
                            return isUsableThumbnail ? (
                              <Image
                                src={resource.thumbnailUrl as string}
                                alt={resource.title}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className={styles.noteMediaImage}
                              />
                            ) : (
                              <div
                                className={styles.noteMediaOg}
                                style={{
                                  backgroundImage: `url(/api/og?title=${encodeURIComponent(resource.title)}&category=${encodeURIComponent(resource.trackName)}&v=3)`,
                                }}
                              />
                            );
                          })()}
                        </div>

                        <div className={styles.noteCardContent}>
                          <div className={styles.noteCardTop}>
                            <NoteCategoryPill category={resource.trackName} slug={resource.trackSlug} />
                            <span className={styles.noteDate}>{formatDate(resource.createdAt)}</span>
                          </div>

                          <h3 className={styles.noteTitle}>
                            <span>{resource.title}</span>
                          </h3>
                          <p className={styles.noteDesc}>{resource.summary}</p>

                          <div className={styles.noteTags}>
                            {resource.tags.slice(0, 3).map((tag) => (
                              <span key={`${resource.id}-${tag}`} className={styles.noteTag}>
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <div className={styles.noteMetrics}>
                            <span className={styles.noteMetric}>
                              {resource.saveCount} {resource.saveCount === 1 ? "save" : "saves"}
                            </span>
                            <span className={styles.noteMetric}>
                              {resource.topicName ?? "General track"}
                            </span>
                          </div>

                          <div className={styles.noteFooter}>
                            <div className={styles.noteAuthorGroup}>
                              <span className={styles.noteAuthorAvatar} aria-hidden="true">
                                {resource.authorName.charAt(0).toUpperCase()}
                              </span>
                              <span className={styles.noteAuthor}>{resource.authorName}</span>
                            </div>

                            <span className={styles.noteViews}>
                              {resource.viewCount} {resource.viewCount === 1 ? "view" : "views"}
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.sectionEmpty}>
                <h3 className={styles.sectionEmptyTitle}>Featured advanced resources will appear here</h3>
                <p className={styles.sectionEmptyText}>
                  Once approved, advanced resources will be highlighted in this section.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection} id="cta-section">
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaGlowLeft} />
            <div className={styles.ctaGlowRight} />
            <h2 className={styles.ctaTitle}>Ready for deeper engineering tracks?</h2>
            <p className={styles.ctaSubtitle}>
              Explore advanced notes, production playbooks, and systems thinking paths curated for
              cloud-native builders.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/tracks/library" id="cta-upload-btn" className="btn btn-primary btn-lg">
                Open Tracks Library
              </Link>
              <Link href="/tracks/notes" id="cta-learn-btn" className="btn btn-secondary btn-lg">
                Browse Advanced Notes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
