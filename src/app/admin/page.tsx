"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

interface AdminNote {
  id: string;
  title: string;
  status: string;
  featured: number;
  view_count: number;
  bookmark_count: number;
  created_at: string;
  category_name: string;
  author_name: string;
  author_email: string;
  thumbnail_url: string;
}

interface Stats {
  totalNotes: number;
  approvedNotes: number;
  pendingNotes: number;
  totalUsers: number;
  totalViews: number;
  totalBookmarks: number;
  pendingReports: number;
  recentViews: number;
}

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
type FilterValue = (typeof FILTERS)[number];

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const getStatusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const getNoteThumbnail = (note: AdminNote) =>
  !note.thumbnail_url || note.thumbnail_url.includes("placeholder")
    ? `/api/og?title=${encodeURIComponent(note.title)}&category=${encodeURIComponent(note.category_name)}&v=3`
    : note.thumbnail_url;

export default function AdminPage() {
  const { data: session } = useSession();

  const [stats, setStats] = useState<Stats | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [query, setQuery] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const userRole = (session?.user as { role?: string })?.role;

  const loadAdminData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const [statsRes, notesRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/notes"),
      ]);

      if (!statsRes.ok || !notesRes.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const statsPayload = await statsRes.json();
      const notesPayload = await notesRes.json();

      setStats(statsPayload.stats ?? null);
      setNotes(notesPayload.notes ?? []);
    } catch {
      setError("Could not load admin data. Please refresh and try again.");
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (userRole === "admin") {
      void loadAdminData(false);
    }
  }, [userRole, loadAdminData]);

  const handleAction = async (
    noteId: string,
    action: "approve" | "reject" | "feature",
    featured?: boolean,
  ) => {
    const actionKey = `${noteId}:${action}`;
    setActiveAction(actionKey);
    setError("");

    try {
      const res = await fetch("/api/admin/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, action, featured }),
      });

      if (!res.ok) {
        throw new Error("Action request failed");
      }

      await loadAdminData(true);
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setActiveAction(null);
    }
  };

  const handleDelete = async (noteId: string, title: string) => {
    const confirmed = window.confirm(
      `Delete \"${title}\" permanently?\n\nThis will remove the note and its related bookmarks, reports, and analytics.`,
    );

    if (!confirmed) return;

    const actionKey = `${noteId}:delete`;
    setActiveAction(actionKey);
    setError("");

    try {
      const res = await fetch("/api/admin/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Delete request failed");
      }

      await loadAdminData(true);
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError("Delete failed. Please try again.");
      }
    } finally {
      setActiveAction(null);
    }
  };

  const statusCount = useMemo(
    () => ({
      all: notes.length,
      pending: notes.filter((note) => note.status === "pending").length,
      approved: notes.filter((note) => note.status === "approved").length,
      rejected: notes.filter((note) => note.status === "rejected").length,
    }),
    [notes],
  );

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notes.filter((note) => {
      const statusMatch = filter === "all" ? true : note.status === filter;
      if (!statusMatch) return false;

      if (!normalizedQuery) return true;

      const searchable = [
        note.title,
        note.author_name,
        note.author_email,
        note.category_name,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [notes, filter, query]);

  const approvalRate =
    stats && stats.totalNotes > 0
      ? Math.round((stats.approvedNotes / stats.totalNotes) * 100)
      : 0;

  const pendingRate =
    stats && stats.totalNotes > 0
      ? Math.round((stats.pendingNotes / stats.totalNotes) * 100)
      : 0;

  const nextPendingTitle = notes.find((note) => note.status === "pending")?.title;

  const isActionBusy = (noteId: string, action: string) =>
    activeAction === `${noteId}:${action}`;

  const isNoteLocked = (noteId: string) =>
    activeAction ? activeAction.startsWith(`${noteId}:`) : false;

  if (!session?.user || userRole !== "admin") {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.denied}>
            <h2>Access Denied</h2>
            <p>You need admin privileges to access this page.</p>
            <Link href="/" className="btn btn-primary">Go Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Admin Command Center</h1>
            <p className={styles.subtitle}>
              Review submissions, curate featured notes, and monitor library health.
            </p>
          </div>
          <button
            className={`btn btn-secondary btn-sm ${styles.refreshBtn}`}
            onClick={() => void loadAdminData(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        {stats && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{formatCompact(stats.totalNotes)}</span>
                <span className={styles.statLabel}>Total Notes</span>
                <span className={styles.statHint}>All submissions + published notes</span>
              </div>

              <div className={`${styles.statCard} ${styles.statWarn}`}>
                <span className={styles.statValue}>{formatCompact(stats.pendingNotes)}</span>
                <span className={styles.statLabel}>Pending Review</span>
                <span className={styles.statHint}>Needs moderator action</span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statValue}>{formatCompact(stats.approvedNotes)}</span>
                <span className={styles.statLabel}>Published</span>
                <span className={styles.statHint}>Visible in the public catalog</span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statValue}>{formatCompact(stats.totalUsers)}</span>
                <span className={styles.statLabel}>Users</span>
                <span className={styles.statHint}>Registered contributors + learners</span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statValue}>{formatCompact(stats.totalViews)}</span>
                <span className={styles.statLabel}>Total Views</span>
                <span className={styles.statHint}>Lifetime engagement</span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statValue}>{formatCompact(stats.totalBookmarks)}</span>
                <span className={styles.statLabel}>Bookmarks</span>
                <span className={styles.statHint}>Saved by the community</span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statValue}>{formatCompact(stats.recentViews)}</span>
                <span className={styles.statLabel}>Views (7d)</span>
                <span className={styles.statHint}>Recent traffic pulse</span>
              </div>

              <div className={`${styles.statCard} ${stats.pendingReports > 0 ? styles.statWarn : ""}`}>
                <span className={styles.statValue}>{formatCompact(stats.pendingReports)}</span>
                <span className={styles.statLabel}>Pending Reports</span>
                <span className={styles.statHint}>Community flagged content</span>
              </div>
            </div>

            <div className={styles.insightRow}>
              <article className={styles.insightCard}>
                <span className={styles.insightLabel}>Approval Rate</span>
                <strong className={styles.insightValue}>{approvalRate}%</strong>
                <div className={styles.progressTrack}>
                  <span
                    className={`${styles.progressFill} ${styles.progressFillOk}`}
                    style={{ width: `${approvalRate}%` }}
                  />
                </div>
              </article>

              <article className={styles.insightCard}>
                <span className={styles.insightLabel}>Pending Load</span>
                <strong className={styles.insightValue}>{pendingRate}%</strong>
                <div className={styles.progressTrack}>
                  <span
                    className={`${styles.progressFill} ${styles.progressFillWarn}`}
                    style={{ width: `${pendingRate}%` }}
                  />
                </div>
              </article>

              <article className={styles.insightCard}>
                <span className={styles.insightLabel}>Queue Snapshot</span>
                <strong className={styles.insightValue}>{statusCount.pending} waiting</strong>
                <p className={styles.insightText}>
                  {nextPendingTitle ? `Next in queue: ${nextPendingTitle}` : "No pending notes right now."}
                </p>
              </article>
            </div>
          </>
        )}

        <div className={styles.panel}>
          <div className={styles.controlRow}>
            <label className={styles.searchWrap}>
              <svg
                className={styles.searchIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={styles.searchInput}
                placeholder="Search by title, author, email, or category"
                aria-label="Search moderation queue"
              />
            </label>

            <div className={styles.controlActions}>
              <Link href="/admin/advanced-tracks" className="btn btn-secondary btn-sm">
                Advanced Tracks Admin
              </Link>
              <Link href="/browse?featured=true" className="btn btn-ghost btn-sm">
                View Featured Feed
              </Link>
            </div>
          </div>

          <div className={styles.filterTabs}>
            {FILTERS.map((value) => (
              <button
                key={value}
                className={`${styles.filterTab} ${filter === value ? styles.filterActive : ""}`}
                onClick={() => setFilter(value)}
              >
                <span>{getStatusLabel(value)}</span>
                <span className={styles.filterCount}>{statusCount[value]}</span>
              </button>
            ))}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {loading ? (
            <div className={styles.loading}>Loading moderation queue...</div>
          ) : (
            <div className={styles.table}>
              {filteredNotes.map((note) => {
                const statusClass =
                  note.status === "approved"
                    ? styles.statusApproved
                    : note.status === "pending"
                      ? styles.statusPending
                      : styles.statusRejected;

                return (
                  <article key={note.id} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div
                        className={styles.rowThumb}
                        style={{ backgroundImage: `url(${getNoteThumbnail(note)})` }}
                      />

                      <div className={styles.rowInfo}>
                        <h3 className={styles.rowTitle}>{note.title}</h3>

                        <div className={styles.rowMeta}>
                          <span className={styles.metaPill}>{note.category_name}</span>
                          <span>{new Date(note.created_at).toLocaleDateString()}</span>
                          <span>{note.view_count} views</span>
                          <span>{note.bookmark_count} saves</span>
                        </div>

                        <div className={styles.rowAuthor}>
                          <span className={styles.rowAuthorAvatar}>
                            {(note.author_name || "U").charAt(0).toUpperCase()}
                          </span>
                          <div className={styles.rowAuthorText}>
                            <span className={styles.rowAuthorName}>{note.author_name || "Unknown author"}</span>
                            <span className={styles.rowAuthorEmail}>{note.author_email || "No email available"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.rowSide}>
                      <div className={styles.rowBadges}>
                        <span className={`${styles.statusBadge} ${statusClass}`}>
                          {getStatusLabel(note.status)}
                        </span>
                        {Boolean(note.featured) && (
                          <span className={styles.featuredBadge}>Featured</span>
                        )}
                      </div>

                      <div className={styles.rowActions}>
                        {note.status === "pending" && (
                          <>
                            <button
                              className={`btn btn-sm ${styles.approveBtn}`}
                              onClick={() => void handleAction(note.id, "approve")}
                              disabled={isNoteLocked(note.id)}
                            >
                              {isActionBusy(note.id, "approve") ? "Approving..." : "Approve"}
                            </button>

                            <button
                              className={`btn btn-sm ${styles.rejectBtn}`}
                              onClick={() => void handleAction(note.id, "reject")}
                              disabled={isNoteLocked(note.id)}
                            >
                              {isActionBusy(note.id, "reject") ? "Rejecting..." : "Reject"}
                            </button>
                          </>
                        )}

                        <button
                          className={`btn btn-sm ${styles.featureBtn}`}
                          onClick={() => void handleAction(note.id, "feature", !note.featured)}
                          disabled={isNoteLocked(note.id)}
                        >
                          {isActionBusy(note.id, "feature")
                            ? "Updating..."
                            : note.featured
                              ? "Unfeature"
                              : "Feature"}
                        </button>

                        <Link href={`/note/${note.id}`} className="btn btn-sm btn-ghost">
                          Open
                        </Link>

                            <button
                              className={`btn btn-sm ${styles.deleteBtn}`}
                              onClick={() => void handleDelete(note.id, note.title)}
                              disabled={isNoteLocked(note.id)}
                            >
                              {isActionBusy(note.id, "delete") ? "Deleting..." : "Delete"}
                            </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {filteredNotes.length === 0 && (
                <div className={styles.empty}>No notes match your current filter and search.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
