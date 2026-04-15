"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";

interface UserNote {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  bookmark_count: number;
  status: string;
  created_at: string;
  category_name: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  website_url: string | null;
}

/* ── Social link icons ──────────────────────────────── */
function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
function TwitterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function WebsiteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

/* ── Edit Profile Modal ──────────────────────────────── */
interface EditModalProps {
  profile: UserProfile;
  onClose: () => void;
  onSave: (updated: UserProfile) => void;
}

function EditProfileModal({ profile, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState({
    name: profile.name || "",
    avatar: profile.avatar || "",
    bio: profile.bio || "",
    githubUrl: profile.github_url || "",
    linkedinUrl: profile.linkedin_url || "",
    twitterUrl: profile.twitter_url || "",
    websiteUrl: profile.website_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    if (selected.size > 2 * 1024 * 1024) {
      setError("Profile image must be under 2MB");
      return;
    }

    setAvatarFile(selected);
    setRemoveAvatar(false);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, avatar: result }));
      setError("");
    };
    reader.onerror = () => setError("Could not read image. Try another file.");
    reader.readAsDataURL(selected);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const payload = new FormData();
      payload.append("name", form.name);
      payload.append("bio", form.bio);
      payload.append("githubUrl", form.githubUrl);
      payload.append("linkedinUrl", form.linkedinUrl);
      payload.append("twitterUrl", form.twitterUrl);
      payload.append("websiteUrl", form.websiteUrl);

      if (avatarFile) {
        payload.append("avatarFile", avatarFile);
      } else if (!removeAvatar && form.avatar.startsWith("data:image/")) {
        // Fallback: preserve selected preview image when file handle is unavailable.
        payload.append("avatar", form.avatar);
      }

      if (removeAvatar) {
        payload.append("removeAvatar", "true");
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: payload,
      });
      const data = await res.json();
      if (res.ok) {
        onSave(data.user as UserProfile);
        onClose();
      } else {
        setError(data.error || "Save failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit Profile</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          {error && <div className={styles.modalError}>{error}</div>}

          <div className="input-group">
            <label className="input-label">Profile Photo</label>
            <div className={styles.modalAvatarRow}>
              <div className={styles.modalAvatarPreview}>
                {form.avatar ? (
                  <Image
                    src={form.avatar}
                    alt={form.name || "User"}
                    className={styles.modalAvatarImage}
                    width={68}
                    height={68}
                    unoptimized
                  />
                ) : (
                  <span>{form.name?.charAt(0).toUpperCase() || "U"}</span>
                )}
              </div>
              <div className={styles.modalAvatarActions}>
                <input
                  type="file"
                  accept="image/*"
                  className={styles.modalAvatarInput}
                  onChange={handleAvatarChange}
                />
                {form.avatar ? (
                  <button
                    type="button"
                    className={styles.modalAvatarRemove}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, avatar: "" }));
                      setAvatarFile(null);
                      setRemoveAvatar(true);
                      setError("");
                    }}
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Display Name</label>
            <input className="input" type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Your name" />
          </div>

          <div className="input-group">
            <label className="input-label">Bio</label>
            <textarea className="input textarea" value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell the community about yourself…"
              rows={3} />
          </div>

          <div className={styles.modalDivider}>
            <span>Social Links</span>
          </div>

          <div className={styles.socialInputGroup}>
            <div className={`${styles.socialInputRow} ${styles.github}`}>
              <span className={styles.socialInputIcon}><GithubIcon /></span>
              <input className={`input ${styles.socialInput}`} type="url"
                value={form.githubUrl}
                onChange={e => setForm({ ...form, githubUrl: e.target.value })}
                placeholder="https://github.com/username" />
            </div>
            <div className={`${styles.socialInputRow} ${styles.linkedin}`}>
              <span className={styles.socialInputIcon}><LinkedInIcon /></span>
              <input className={`input ${styles.socialInput}`} type="url"
                value={form.linkedinUrl}
                onChange={e => setForm({ ...form, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/username" />
            </div>
            <div className={`${styles.socialInputRow} ${styles.twitter}`}>
              <span className={styles.socialInputIcon}><TwitterIcon /></span>
              <input className={`input ${styles.socialInput}`} type="url"
                value={form.twitterUrl}
                onChange={e => setForm({ ...form, twitterUrl: e.target.value })}
                placeholder="https://x.com/username" />
            </div>
            <div className={`${styles.socialInputRow} ${styles.website}`}>
              <span className={styles.socialInputIcon}><WebsiteIcon /></span>
              <input className={`input ${styles.socialInput}`} type="url"
                value={form.websiteUrl}
                onChange={e => setForm({ ...form, websiteUrl: e.target.value })}
                placeholder="https://yourwebsite.com" />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-profile-btn">
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Main Profile Page ───────────────────────────────── */
export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const [tab, setTab] = useState<"notes" | "bookmarks">("notes");
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [bookmarks, setBookmarks] = useState<UserNote[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "bookmarks") setTab("bookmarks");
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!session?.user) return;
      setLoading(true);
      try {
        const [notesRes, bookmarksRes, profileRes] = await Promise.all([
          fetch(`/api/notes?author=${session.user.id}&status=all`),
          fetch("/api/bookmarks"),
          fetch("/api/profile"),
        ]);
        if (notesRes.ok)     { const d = await notesRes.json();     setUserNotes(d.notes || []); }
        if (bookmarksRes.ok) { const d = await bookmarksRes.json(); setBookmarks(d.bookmarks || []); }
        if (profileRes.ok)   { const d = await profileRes.json();   setProfile(d.user); }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [session]);

  const copyProfileLink = () => {
    if (!session?.user?.id) return;
    navigator.clipboard.writeText(`${window.location.origin}/user/${session.user.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading") return <div className={styles.page}><div className={styles.container}><div className={styles.loading}>Loading…</div></div></div>;

  if (!session?.user) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.authPrompt}>
            <h2>Sign in to view your profile</h2>
            <Link href="/login" className="btn btn-primary btn-lg">Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  const totalViews = userNotes.reduce((s, n) => s + (n.view_count || 0), 0);
  const hasSocials = profile?.github_url || profile?.linkedin_url || profile?.twitter_url || profile?.website_url;
  const handleProfileSave = async (updated: UserProfile) => {
    setProfile(updated);

    // Keep session payload lightweight: never pass base64 images here.
    const nextName = updated.name?.trim() || session?.user?.name?.trim() || undefined;
    const currentName = session?.user?.name?.trim() || undefined;

    const nextImage =
      updated.avatar && !updated.avatar.startsWith("data:image/")
        ? updated.avatar
        : null;
    const currentImage = session?.user?.image || null;

    if (nextName === currentName && nextImage === currentImage) {
      return;
    }

    try {
      await update({
        name: nextName,
        image: nextImage,
      });
    } catch {
      // Non-blocking: UI still has latest profile state from API response.
    }
  };

  return (
    <div className={styles.page}>
      {editOpen && (
        <EditProfileModal
          profile={profile || {
            id: session.user.id,
            name: session.user.name || "",
            email: session.user.email || "",
            avatar: null,
            bio: "",
            github_url: "",
            linkedin_url: "",
            twitter_url: "",
            website_url: ""
           } as UserProfile}
          onClose={() => setEditOpen(false)}
          onSave={handleProfileSave}
        />
      )}

      <div className={styles.container}>
        {/* ── Profile header ────────────────────── */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar}>
              {profile?.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.name || "User"}
                  className={styles.avatarImage}
                  width={96}
                  height={96}
                  unoptimized
                />
              ) : (
                (profile?.name || session.user.name)?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div className={styles.avatarGlow} />
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.profileNameRow}>
              <h1 className={styles.profileName}>{profile?.name || session.user.name}</h1>
              <button
                className={`btn btn-secondary btn-sm ${styles.editBtn}`}
                onClick={() => setEditOpen(true)}
                id="edit-profile-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Profile
              </button>
            </div>

            <p className={styles.profileEmail}>{session.user.email}</p>

            {profile?.bio && (
              <p className={styles.profileBio}>{profile.bio}</p>
            )}

            {/* Stats row */}
            <div className={styles.profileStats}>
              <div className={styles.statPill}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <strong>{userNotes.length}</strong> notes
              </div>
              <div className={styles.statPill}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <strong>{totalViews.toLocaleString()}</strong> views
              </div>
              <div className={styles.statPill}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <strong>{bookmarks.length}</strong> bookmarks
              </div>
            </div>

            {/* Social links */}
            {hasSocials ? (
              <div className={styles.socialLinks}>
                {profile?.github_url && (
                  <a href={profile.github_url} target="_blank" rel="noopener noreferrer"
                    className={`${styles.socialBtn} ${styles.socialGithub}`} id="github-link">
                    <GithubIcon /> GitHub
                  </a>
                )}
                {profile?.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className={`${styles.socialBtn} ${styles.socialLinkedin}`} id="linkedin-link">
                    <LinkedInIcon /> LinkedIn
                  </a>
                )}
                {profile?.twitter_url && (
                  <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer"
                    className={`${styles.socialBtn} ${styles.socialTwitter}`} id="twitter-link">
                    <TwitterIcon /> Twitter / X
                  </a>
                )}
                {profile?.website_url && (
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer"
                    className={`${styles.socialBtn} ${styles.socialWebsite}`} id="website-link">
                    <WebsiteIcon /> Website
                  </a>
                )}
              </div>
            ) : (
              <button className={styles.addSocialsPrompt} onClick={() => setEditOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add GitHub, LinkedIn & more to let people connect with you
              </button>
            )}

            {/* Share profile */}
            <button className={styles.shareProfileBtn} onClick={copyProfileLink} id="copy-profile-link-btn">
              {copied ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Copy Public Profile Link</>
              )}
            </button>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────── */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === "notes" ? styles.tabActive : ""}`} onClick={() => setTab("notes")}>
            My Notes ({userNotes.length})
          </button>
          <button className={`${styles.tab} ${tab === "bookmarks" ? styles.tabActive : ""}`} onClick={() => setTab("bookmarks")}>
            Bookmarks ({bookmarks.length})
          </button>
        </div>

        {/* ── Content ───────────────────────────── */}
        {loading ? (
          <div className={styles.loading}>Loading your content…</div>
        ) : tab === "notes" ? (
          <div className={styles.notesList}>
            {userNotes.length === 0 ? (
              <div className={styles.empty}>
                <p>You haven&apos;t uploaded any notes yet.</p>
                <Link href="/upload" className="btn btn-primary">Upload Your First Note</Link>
              </div>
            ) : (
              userNotes.map(note => (
                <Link key={note.id} href={`/note/${note.id}`} className={styles.noteRow}>
                  <div className={styles.noteThumb} style={{ backgroundImage: `url(${(!note.thumbnail_url || note.thumbnail_url.includes("placeholder")) ? "/api/og?title=" + encodeURIComponent(note.title) + "&category=" + encodeURIComponent(note.category_name) + "&v=3" : note.thumbnail_url})` }} />
                  <div className={styles.noteInfo}>
                    <h3 className={styles.noteTitle}>{note.title}</h3>
                    <div className={styles.noteMeta}>
                      <span className={`badge ${note.status === "approved" ? "badge-green" : note.status === "pending" ? "badge-yellow" : ""}`}>
                        {note.status}
                      </span>
                      <span>{note.category_name}</span>
                      <span>{note.view_count} views</span>
                      <span>{note.bookmark_count} saves</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : (
          <div className={styles.notesList}>
            {bookmarks.length === 0 ? (
              <div className={styles.empty}>
                <p>You haven&apos;t bookmarked any notes yet.</p>
                <Link href="/browse" className="btn btn-primary">Browse Notes</Link>
              </div>
            ) : (
              bookmarks.map(note => (
                <Link key={note.id} href={`/note/${note.id}`} className={styles.noteRow}>
                  <div className={styles.noteThumb} style={{ backgroundImage: `url(${(!note.thumbnail_url || note.thumbnail_url.includes("placeholder")) ? "/api/og?title=" + encodeURIComponent(note.title) + "&category=" + encodeURIComponent(note.category_name) + "&v=3" : note.thumbnail_url})` }} />
                  <div className={styles.noteInfo}>
                    <h3 className={styles.noteTitle}>{note.title}</h3>
                    <div className={styles.noteMeta}>
                      <span>{note.category_name}</span>
                      <span>{note.view_count} views</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
