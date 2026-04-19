import Image from "next/image";
import Link from "next/link";
import { getTechIcon } from "@/lib/techIcons";
import styles from "./NoteCard.module.css";

interface NoteCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug?: string;
  categoryColor?: string;
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
  // Support custom href for external links or advanced resources
  href?: string;
  // For advanced resources: open link in new tab
  external?: boolean;
}

/* ── Social Icons ── */
function GithubIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>; }
function LinkedInIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>; }
function TwitterIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>; }
function WebIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>; }

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

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

export default function NoteCard({
  id,
  title,
  description,
  category,
  categorySlug,
  categoryColor = "default",
  author,
  authorId,
  authorGithub,
  authorLinkedin,
  authorTwitter,
  authorWebsite,
  thumbnailUrl,
  viewCount,
  bookmarkCount,
  tags,
  createdAt,
  href,
  external = false,
}: NoteCardProps) {
  const hasSocials = authorGithub || authorLinkedin || authorTwitter || authorWebsite;
  const authorProfileUrl = authorId ? `/user/${authorId}` : "#";
  const effectiveCategorySlug = normalizeSlug(categorySlug || categoryColor || category);
  
  // Use custom href for advanced resources/external links, default to /note/[id]
  const cardHref = href || `/note/${id}`;

  return (
    <article className={styles.noteCard} id={`note-card-${id}`}>
      <Link 
        href={cardHref} 
        className={styles.cardHitbox} 
        aria-label={`View ${title}`}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      />

      <div className={styles.noteMedia}>
      {(() => {
        // Use OG image generator fallback for missing, placeholder, or non-image thumbnail URLs
        // (e.g. /api/files/xxx which might be a PDF, not an actual image thumbnail)
        const isUsableThumbnail =
          thumbnailUrl &&
          !thumbnailUrl.includes("placeholder") &&
          !thumbnailUrl.startsWith("/api/files/");

        return isUsableThumbnail ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, (max-width: 1700px) 33vw, 25vw"
            className={styles.noteMediaImage}
          />
        ) : (
          <div
            className={styles.noteMediaOg}
            style={{
              backgroundImage: `url(/api/og?title=${encodeURIComponent(title)}&category=${encodeURIComponent(category)}&v=3)`,
            }}
          />
        );
      })()}
      </div>

      <div className={styles.noteCardContent}>
        <div className={styles.noteCardTop}>
          <NoteCategoryPill category={category} slug={effectiveCategorySlug} />
          <span className={styles.noteDate}>{createdAt}</span>
        </div>

        <h3 className={styles.noteTitle}>
          <span>{title}</span>
        </h3>
        <p className={styles.noteDesc}>{description}</p>

        {tags.length > 0 && (
          <div className={styles.noteTags}>
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.noteTag}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className={styles.noteMetrics}>
          <span className={styles.noteMetric}>
            {bookmarkCount} {bookmarkCount === 1 ? "save" : "saves"}
          </span>
          <span className={styles.noteMetric}>{tags.length} tags</span>
        </div>

        <div className={styles.noteFooter}>
          <div className={styles.noteAuthorWrap}>
            <Link href={authorProfileUrl} className={styles.noteAuthorGroup}>
              <span className={styles.noteAuthorAvatar} aria-hidden="true">
                {author.charAt(0).toUpperCase()}
              </span>
              <span className={styles.noteAuthor}>{author}</span>
            </Link>

            <div className={styles.authorPopoverShell}>
              <div className={styles.authorPopover}>
                <div className={styles.popoverHeader}>
                  <div className={styles.popoverAvatar}>{author.charAt(0).toUpperCase()}</div>
                  <div className={styles.popoverInfo}>
                    <p className={styles.popoverName}>{author}</p>
                    <Link href={authorProfileUrl} className={styles.popoverLink}>View Profile</Link>
                  </div>
                </div>

                {hasSocials && (
                  <div className={styles.popoverSocials}>
                    {authorGithub && (
                      <a href={authorGithub} target="_blank" rel="noopener noreferrer" className={styles.popSocial}><GithubIcon /> GitHub</a>
                    )}
                    {authorLinkedin && (
                      <a href={authorLinkedin} target="_blank" rel="noopener noreferrer" className={styles.popSocial}><LinkedInIcon /> LinkedIn</a>
                    )}
                    {authorTwitter && (
                      <a href={authorTwitter} target="_blank" rel="noopener noreferrer" className={styles.popSocial}><TwitterIcon /> Twitter</a>
                    )}
                    {authorWebsite && (
                      <a href={authorWebsite} target="_blank" rel="noopener noreferrer" className={styles.popSocial}><WebIcon /> Website</a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className={styles.noteViews}>{viewCount} {viewCount === 1 ? "view" : "views"}</span>
        </div>
      </div>
    </article>
  );
}
