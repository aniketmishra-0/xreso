import Link from "next/link";
import styles from "./NoteCard.module.css";

interface NoteCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
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
}

/* ── Social Icons ── */
function GithubIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>; }
function LinkedInIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>; }
function TwitterIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>; }
function WebIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>; }

export default function NoteCard({
  id,
  title,
  description,
  category,
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
}: NoteCardProps) {
  const colorMap: Record<string, string> = {
    python: "badge-blue",
    javascript: "badge-yellow",
    sql: "badge-green",
    java: "badge-purple",
    default: "",
  };

  const badgeClass = colorMap[categoryColor] || colorMap.default;

  const hasSocials = authorGithub || authorLinkedin || authorTwitter || authorWebsite;
  const authorProfileUrl = authorId ? `/user/${authorId}` : "#";

  return (
    <div className={styles.card} id={`note-card-${id}`}>
      {/* Invisible link overlay covering the card */}
      <Link href={`/note/${id}`} className={styles.cardHitbox} aria-label={`View ${title}`} />

      <div className={styles.thumbnailWrap}>
        <div
          className={styles.thumbnail}
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
          }}
        />
        <div className={styles.overlay}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>View Notes</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.meta}>
          <span className={`badge ${badgeClass}`}>{category}</span>
          <span className={styles.date}>{createdAt}</span>
        </div>

        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.authorWrap}>
            <Link href={authorProfileUrl} className={styles.author}>
              <div className={styles.authorAvatar}>
                {author.charAt(0).toUpperCase()}
              </div>
              <span className={styles.authorName}>{author}</span>
            </Link>

            {/* Hover Popover */}
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

          <div className={styles.stats}>
            <span className={styles.stat}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {viewCount}
            </span>
            <span className={styles.stat}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {bookmarkCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
