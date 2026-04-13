"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
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

export default function AdminPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, notesRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/notes"),
        ]);
        if (statsRes.ok) setStats((await statsRes.json()).stats);
        if (notesRes.ok) setNotes((await notesRes.json()).notes || []);
      } catch {
        console.error("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }
    if (userRole === "admin") fetchData();
  }, [userRole]);

  const handleAction = async (noteId: string, action: string, featured?: boolean) => {
    try {
      await fetch("/api/admin/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, action, featured }),
      });
      // Refresh data
      const res = await fetch("/api/admin/notes");
      if (res.ok) setNotes((await res.json()).notes || []);
      const sRes = await fetch("/api/admin/stats");
      if (sRes.ok) setStats((await sRes.json()).stats);
    } catch {
      console.error("Action failed");
    }
  };

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

  const filteredNotes = filter === "all"
    ? notes
    : notes.filter((n) => n.status === filter);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.subtitle}>Manage content, users, and platform settings</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.totalNotes}</span>
              <span className={styles.statLabel}>Total Notes</span>
            </div>
            <div className={`${styles.statCard} ${styles.statPending}`}>
              <span className={styles.statValue}>{stats.pendingNotes}</span>
              <span className={styles.statLabel}>Pending Review</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.approvedNotes}</span>
              <span className={styles.statLabel}>Published</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.totalUsers}</span>
              <span className={styles.statLabel}>Users</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.totalViews.toLocaleString()}</span>
              <span className={styles.statLabel}>Total Views</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.totalBookmarks}</span>
              <span className={styles.statLabel}>Bookmarks</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{stats.recentViews}</span>
              <span className={styles.statLabel}>Views (7d)</span>
            </div>
            <div className={`${styles.statCard} ${stats.pendingReports > 0 ? styles.statPending : ""}`}>
              <span className={styles.statValue}>{stats.pendingReports}</span>
              <span className={styles.statLabel}>Reports</span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          {["all", "pending", "approved", "rejected"].map((f) => (
            <button
              key={f}
              className={`${styles.filterTab} ${filter === f ? styles.filterActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && stats ? ` (${stats.pendingNotes})` : ""}
            </button>
          ))}
        </div>

        {/* Notes Table */}
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <div className={styles.table}>
            {filteredNotes.map((note) => (
              <div key={note.id} className={styles.row}>
                <div
                  className={styles.rowThumb}
                  style={{ backgroundImage: `url(${note.thumbnail_url})` }}
                />
                <div className={styles.rowInfo}>
                  <h3 className={styles.rowTitle}>{note.title}</h3>
                  <div className={styles.rowMeta}>
                    <span>{note.author_name}</span>
                    <span>·</span>
                    <span>{note.category_name}</span>
                    <span>·</span>
                    <span>{new Date(note.created_at).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>{note.view_count} views</span>
                  </div>
                </div>
                <div className={styles.rowStatus}>
                  <span className={`badge ${
                    note.status === "approved" ? "badge-green" :
                    note.status === "pending" ? "badge-yellow" : ""
                  }`}>
                    {note.status}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  {note.status === "pending" && (
                    <>
                      <button
                        className={`btn btn-sm ${styles.approveBtn}`}
                        onClick={() => handleAction(note.id, "approve")}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className={`btn btn-sm ${styles.rejectBtn}`}
                        onClick={() => handleAction(note.id, "reject")}
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                  <button
                    className={`btn btn-sm btn-ghost`}
                    onClick={() => handleAction(note.id, "feature", !note.featured)}
                  >
                    {note.featured ? "★ Unfeature" : "☆ Feature"}
                  </button>
                </div>
              </div>
            ))}
            {filteredNotes.length === 0 && (
              <div className={styles.empty}>No notes matching this filter.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
