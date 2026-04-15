"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

interface PublicUser {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  website_url: string | null;
  created_at: string;
}
interface PublicNote {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  bookmark_count: number;
  category_name: string;
  created_at: string;
}

function GithubIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>;
}
function LinkedInIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
}
function TwitterIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
}
function WebIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
}

export default function PublicUserPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const userId = params?.id as string;
  const isOwnProfile = session?.user?.id === userId;

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`/api/user/${userId}`);
        if (!res.ok) { setError("User not found"); return; }
        const data = await res.json();
        setUser(data.user);
        setNotes(data.notes || []);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    if (userId) fetchUser();
  }, [userId]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            <p>Loading profile…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>😔</div>
            <h2>Profile not found</h2>
            <p>{error}</p>
            <Link href="/browse" className="btn btn-primary">Browse Notes</Link>
          </div>
        </div>
      </div>
    );
  }

  const joined = new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const hasSocials = user.github_url || user.linkedin_url || user.twitter_url || user.website_url;

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Hero profile card ─────────────── */}
        <div className={styles.profileCard}>
          <div className={styles.profileCardBg} />

          <div className={styles.profileCardContent}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.name || "User"}
                    className={styles.avatarImage}
                    width={96}
                    height={96}
                    unoptimized
                  />
                ) : (
                  user.name?.charAt(0).toUpperCase() || "U"
                )}
              </div>
              <div className={styles.avatarGlow} />
            </div>

            <div className={styles.profileInfo}>
              <div className={styles.nameRow}>
                <h1 className={styles.profileName}>{user.name}</h1>
                {isOwnProfile && (
                  <Link href="/profile" className="btn btn-secondary btn-sm">
                    Edit Profile
                  </Link>
                )}
              </div>

              <p className={styles.joinDate}>Member since {joined}</p>

              {user.bio && <p className={styles.bio}>{user.bio}</p>}

              {/* Stats */}
              <div className={styles.statsRow}>
                <div className={styles.statChip}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <strong>{notes.length}</strong> notes published
                </div>
                <div className={styles.statChip}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <strong>{notes.reduce((s, n) => s + (n.view_count || 0), 0).toLocaleString()}</strong> total views
                </div>
              </div>

              {/* Social links */}
              {hasSocials && (
                <div className={styles.socialLinks}>
                  {user.github_url && (
                    <a href={user.github_url} target="_blank" rel="noopener noreferrer"
                      className={`${styles.socialBtn} ${styles.github}`} id="pub-github-link">
                      <GithubIcon /> GitHub
                    </a>
                  )}
                  {user.linkedin_url && (
                    <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className={`${styles.socialBtn} ${styles.linkedin}`} id="pub-linkedin-link">
                      <LinkedInIcon /> LinkedIn
                    </a>
                  )}
                  {user.twitter_url && (
                    <a href={user.twitter_url} target="_blank" rel="noopener noreferrer"
                      className={`${styles.socialBtn} ${styles.twitter}`} id="pub-twitter-link">
                      <TwitterIcon /> Twitter / X
                    </a>
                  )}
                  {user.website_url && (
                    <a href={user.website_url} target="_blank" rel="noopener noreferrer"
                      className={`${styles.socialBtn} ${styles.website}`} id="pub-website-link">
                      <WebIcon /> Website
                    </a>
                  )}
                </div>
              )}

              {/* Action buttons for other users */}
              {!isOwnProfile && (
                <div className={styles.actionRow}>
                  {user.github_url && (
                    <a href={user.github_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-primary" id="follow-github-btn">
                      <GithubIcon /> Follow on GitHub
                    </a>
                  )}
                  {user.linkedin_url && (
                    <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className={`btn btn-secondary ${styles.connectLinkedin}`} id="connect-linkedin-btn">
                      <LinkedInIcon /> Connect on LinkedIn
                    </a>
                  )}
                  <button className="btn btn-secondary" onClick={copyLink} id="copy-profile-btn">
                    {copied ? "✓ Copied!" : "Share Profile"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Notes grid ───────────────────── */}
        <div className={styles.notesSection}>
          <h2 className={styles.notesSectionTitle}>
            Notes by {user.name}
            <span className={styles.noteCount}>{notes.length}</span>
          </h2>

          {notes.length === 0 ? (
            <div className={styles.emptyNotes}>
              <p>No published notes yet.</p>
              <Link href="/browse" className="btn btn-secondary btn-sm">Browse All Notes</Link>
            </div>
          ) : (
            <div className={styles.notesGrid}>
              {notes.map(note => (
                <Link key={note.id} href={`/note/${note.id}`} className={styles.noteCard} id={`user-note-${note.id}`}>
                  <div className={styles.noteThumb}
                    style={{ backgroundImage: `url(${(!note.thumbnail_url || note.thumbnail_url.includes("placeholder")) ? "/api/og?title=" + encodeURIComponent(note.title) + "&category=" + encodeURIComponent(note.category_name) + "&v=3" : note.thumbnail_url})` }}>
                    <div className={styles.noteThumbOverlay}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                  </div>
                  <div className={styles.noteCardBody}>
                    <span className="badge">{note.category_name}</span>
                    <h3 className={styles.noteCardTitle}>{note.title}</h3>
                    <div className={styles.noteCardMeta}>
                      <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        {note.view_count.toLocaleString()}
                      </span>
                      <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        {note.bookmark_count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
