"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import UnifiedDropdown from "@/components/UnifiedDropdown/UnifiedDropdown";
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

interface WorkbookSnapshot {
  exists: boolean;
  sizeBytes: number;
  sheets: Array<{ name: string; rows: number }>;
}

interface StorageWorkbook {
  key: string;
  label: string;
  primarySheet: string;
  expectedSheets: string[];
  localPath: string;
  oneDrivePath: string;
  pendingPath: string;
  localSnapshot: WorkbookSnapshot;
  pendingSnapshot: WorkbookSnapshot;
  remoteSnapshot: WorkbookSnapshot | null;
}

interface AdminReport {
  note_id: string;
  report_count: number;
  last_reported_at: string;
  title: string;
  note_status: string;
  author_name: string;
}

interface StorageStatus {
  mode: "local" | "onedrive";
  note: string;
  workbooks: StorageWorkbook[];
}

interface AdvTrack {
  id: number;
  slug: string;
  name: string;
  description: string;
}

interface AdvTopic {
  id: number;
  track_id: number;
  slug: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

interface AdvResource {
  id: string;
  title: string;
  summary: string;
  resource_type: "link" | "pdf" | "doc" | "video";
  content_url: string;
  premium_only: number;
  featured: number;
  status: "draft" | "pending" | "approved" | "rejected" | "archived";
  created_at: string;
  track_slug: string;
  track_name: string;
  topic_slug: string | null;
  topic_name: string | null;
  author_name: string;
  tag_names: string | null;
}

const ADV_INITIAL_FORM = {
  title: "",
  summary: "",
  trackSlug: "",
  topicSlug: "",
  resourceType: "link" as "link" | "pdf" | "doc" | "video",
  contentUrl: "",
  thumbnailUrl: "",
  tags: "",
  status: "approved" as "draft" | "pending" | "approved",
  featured: false,
};

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

const formatBytes = (value: number) => {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const formatted = value / 1024 ** exponent;
  return `${formatted.toFixed(formatted >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const getStorageFlowLabel = (workbookKey: StorageWorkbook["key"]) => {
  if (workbookKey === "community") return "Community uploads";
  if (workbookKey === "advanced") return "Advanced uploads";
  return "Admin audit events";
};

export default function AdminPage() {
  const { data: session, status } = useSession();

  const [stats, setStats] = useState<Stats | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [query, setQuery] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveToggling, setAutoApproveToggling] = useState(false);
  const [shareTemplates, setShareTemplates] = useState({
    x: "",
    linkedin: "",
    whatsapp: "",
    telegram: "",
  });
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [templatesSaved, setTemplatesSaved] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [curatedThreshold, setCuratedThreshold] = useState("500");
  const [thresholdSaving, setThresholdSaving] = useState(false);

  // Advanced tracks state
  const [advTracks, setAdvTracks] = useState<AdvTrack[]>([]);
  const [advTopics, setAdvTopics] = useState<AdvTopic[]>([]);
  const [advResources, setAdvResources] = useState<AdvResource[]>([]);
  const [advForm, setAdvForm] = useState(ADV_INITIAL_FORM);
  const [advSaving, setAdvSaving] = useState(false);
  const [advMessage, setAdvMessage] = useState("");

  // Reports state
  const [reports, setReports] = useState<AdminReport[]>([]);

  // Users state
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; name: string; email: string; role: string; image: string; created_at: string; note_count: number; total_views: number }>>([]);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  // Categories state
  const [adminCategories, setAdminCategories] = useState<Array<{ id: number; name: string; slug: string; description: string; icon: string; noteCount: number }>>([]);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; admin_email: string; action: string; target_type: string; target_id: string; details: string; created_at: string }>>([]);

  type AdminTab = "overview" | "submissions" | "advanced" | "reports" | "users" | "taxonomy" | "audit" | "config";
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const userRole = (session?.user as { role?: string })?.role;

  const loadAdminData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    setStorageError("");

    try {
      const [statsRes, notesRes, storageRes] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/notes", { cache: "no-store" }),
        fetch("/api/admin/storage-status", { cache: "no-store" }),
      ]);

      if (!statsRes.ok || !notesRes.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const statsPayload = await statsRes.json();
      const notesPayload = await notesRes.json();

      setStats(statsPayload.stats ?? null);
      setNotes(notesPayload.notes ?? []);

      if (storageRes.ok) {
        const storagePayload = (await storageRes.json()) as { storage?: StorageStatus };
        setStorage(storagePayload.storage ?? null);
      } else {
        setStorage(null);
        setStorageError("Storage routing status could not be loaded.");
      }
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

  // Load auto-approve setting + share templates
  useEffect(() => {
    if (userRole !== "admin") return;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { settings?: {
        auto_approve_enabled?: boolean;
        curated_views_threshold?: string;
        share_template_x?: string;
        share_template_linkedin?: string;
        share_template_whatsapp?: string;
        share_template_telegram?: string;
      } }) => {
        setAutoApproveEnabled(data.settings?.auto_approve_enabled ?? false);
        setCuratedThreshold(data.settings?.curated_views_threshold || "500");
        setShareTemplates({
          x: data.settings?.share_template_x || "",
          linkedin: data.settings?.share_template_linkedin || "",
          whatsapp: data.settings?.share_template_whatsapp || "",
          telegram: data.settings?.share_template_telegram || "",
        });
      })
      .catch(() => {});
  }, [userRole]);

  const handleAutoApproveToggle = async () => {
    setAutoApproveToggling(true);
    setError("");
    const newValue = !autoApproveEnabled;
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "auto_approve_enabled", value: String(newValue) }),
      });
      if (!res.ok) throw new Error("Failed to update setting");
      setAutoApproveEnabled(newValue);
      // Refresh data to see updated counts
      await loadAdminData(true);
    } catch {
      setError("Failed to toggle auto-approval.");
    } finally {
      setAutoApproveToggling(false);
    }
  };

  const handleTemplateSave = async (platform: string) => {
    setTemplatesSaving(true);
    setTemplatesSaved(false);
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `share_template_${platform}`,
          value: shareTemplates[platform as keyof typeof shareTemplates],
        }),
      });
      if (!res.ok) throw new Error("Failed to save template");
      setTemplatesSaved(true);
      setTimeout(() => setTemplatesSaved(false), 2500);
    } catch {
      setError(`Failed to save ${platform} template.`);
    } finally {
      setTemplatesSaving(false);
    }
  };

  const handleSaveAllTemplates = async () => {
    setTemplatesSaving(true);
    setTemplatesSaved(false);
    setError("");
    try {
      const platforms = ["x", "linkedin", "whatsapp", "telegram"] as const;
      for (const platform of platforms) {
        const value = shareTemplates[platform];
        if (!value) continue;
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: `share_template_${platform}`, value }),
        });
        if (!res.ok) throw new Error(`Failed to save ${platform} template`);
      }
      setTemplatesSaved(true);
      setTimeout(() => setTemplatesSaved(false), 3000);
    } catch {
      setError("Failed to save templates.");
    } finally {
      setTemplatesSaving(false);
    }
  };

  useEffect(() => {
    if (userRole === "admin") {
      void loadAdminData(false);
    }
  }, [userRole, loadAdminData]);

  // Load advanced tracks data
  const loadAdvData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/advanced-tracks", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as { tracks: AdvTrack[]; topics: AdvTopic[]; resources: AdvResource[] };
      setAdvTracks(payload.tracks || []);
      setAdvTopics(payload.topics || []);
      setAdvResources(payload.resources || []);
      setAdvForm((prev) => {
        if (prev.trackSlug || !payload.tracks?.length) return prev;
        return { ...prev, trackSlug: payload.tracks[0].slug };
      });
    } catch { /* swallow */ }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setReports(data.reports || []);
    } catch { /* swallow */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAdminUsers(data.users || []);
    } catch { /* swallow */ }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAdminCategories(data.categories || []);
    } catch { /* swallow */ }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit-logs", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => {
    if (userRole === "admin") {
      void loadAdvData();
      void loadReports();
      void loadUsers();
      void loadCategories();
      void loadAuditLogs();
    }
  }, [userRole, loadAdvData, loadReports, loadUsers, loadCategories, loadAuditLogs]);

  const advScopedTopics = useMemo(() => {
    if (!advForm.trackSlug) return [];
    const t = advTracks.find((tr) => tr.slug === advForm.trackSlug);
    if (!t) return [];
    return advTopics.filter((tp) => tp.track_id === t.id);
  }, [advForm.trackSlug, advTopics, advTracks]);

  const advSummary = useMemo(() => ({
    total: advResources.length,
    pending: advResources.filter((r) => r.status === "pending").length,
    approved: advResources.filter((r) => r.status === "approved").length,
    featured: advResources.filter((r) => Boolean(r.featured)).length,
  }), [advResources]);

  const handleAdvCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdvSaving(true);
    setError("");
    setAdvMessage("");
    try {
      const res = await fetch("/api/admin/advanced-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...advForm, premiumOnly: false, tags: advForm.tags, topicSlug: advForm.topicSlug || undefined }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Create failed");
      setAdvMessage("Resource created successfully.");
      setAdvForm((prev) => ({ ...ADV_INITIAL_FORM, trackSlug: prev.trackSlug }));
      await loadAdvData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create resource.");
    } finally {
      setAdvSaving(false);
    }
  };

  const handleAdvAction = async (resourceId: string, action: "approve" | "reject" | "archive" | "feature" | "unfeature") => {
    setError("");
    try {
      const res = await fetch("/api/admin/advanced-tracks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId, action }) });
      if (!res.ok) { const p = (await res.json()) as { error?: string }; throw new Error(p.error || "Action failed"); }
      await loadAdvData();
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
  };

  const handleAdvDelete = async (resourceId: string) => {
    if (!window.confirm("Delete this resource permanently?")) return;
    setError("");
    try {
      const res = await fetch("/api/admin/advanced-tracks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId }) });
      if (!res.ok) { const p = (await res.json()) as { error?: string }; throw new Error(p.error || "Delete failed"); }
      await loadAdvData();
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  };

  const handleDismissReport = async (noteId: string) => {
    setError("");
    try {
      const res = await fetch("/api/admin/reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId })
      });
      if (!res.ok) throw new Error("Failed to dismiss report");
      await loadReports();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to dismiss report"); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleChanging(userId);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change role");
      }
      await loadUsers();
      await loadAuditLogs();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to change role"); }
    finally { setRoleChanging(null); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user and all their notes? This action cannot be undone.")) return;
    
    setRoleChanging(userId);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      await loadUsers();
      await loadAuditLogs();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to delete user"); }
    finally { setRoleChanging(null); }
  };

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
  const storageModeLabel = storage?.mode === "onedrive" ? "OneDrive sync" : "Local workbooks";
  const storageLiveStatus = storage?.mode === "onedrive" ? "OneDrive active" : "Local fallback active";
  const pendingWorkbookCount =
    storage?.workbooks.filter((workbook) => workbook.pendingSnapshot.exists).length ?? 0;

  const isActionBusy = (noteId: string, action: string) =>
    activeAction === `${noteId}:${action}`;

  const isNoteLocked = (noteId: string) =>
    activeAction ? activeAction.startsWith(`${noteId}:`) : false;

  if (status === "loading") {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loading}>Loading admin access...</div>
        </div>
      </div>
    );
  }

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
        <div className={styles.adminLayout}>

          {/* ── SIDEBAR ── */}
          <aside className={styles.adminSidebar}>
            <div className={styles.sidebarHeader}>
              <h1 className={styles.sidebarTitle}>Admin Center</h1>
              <p className={styles.sidebarSubtitle}>Library command console</p>
            </div>
            <nav className={styles.sidebarNav}>
              <button
                className={activeTab === "overview" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("overview")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
                <span className={styles.navLabel}>Overview</span>
              </button>
              <button
                className={activeTab === "submissions" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("submissions")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span className={styles.navLabel}>Programming</span>
                {statusCount.pending > 0 && <span className={styles.navBadge}>{statusCount.pending}</span>}
              </button>
              <button
                className={activeTab === "advanced" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("advanced")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span className={styles.navLabel}>Advanced Tracks</span>
                {advSummary.pending > 0 && <span className={styles.navBadge}>{advSummary.pending}</span>}
              </button>
              <button
                className={activeTab === "reports" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("reports")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                <span className={styles.navLabel}>Reports</span>
                {reports.length > 0 && <span className={styles.navBadge}>{reports.length}</span>}
              </button>
              <button
                className={activeTab === "users" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("users")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span className={styles.navLabel}>Users</span>
              </button>
              <button
                className={activeTab === "taxonomy" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("taxonomy")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                <span className={styles.navLabel}>Categories</span>
              </button>
              <button
                className={activeTab === "audit" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("audit")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span className={styles.navLabel}>Audit Logs</span>
              </button>
              <button
                className={activeTab === "config" ? styles.navItemActive : styles.navItem}
                onClick={() => setActiveTab("config")}
              >
                <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span className={styles.navLabel}>Configuration</span>
              </button>
            </nav>
          </aside>

          {/* ── MAIN CONTENT ── */}
          <main className={styles.adminMain}>

            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === "overview" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>Platform Overview</h2>
                    <p className={styles.adminTabSubtitle}>High-level metrics and system performance.</p>
                  </div>
                  <div className={styles.tabActions}>
                    <button
                      className={`btn btn-secondary btn-sm ${styles.refreshBtn}`}
                      onClick={() => void loadAdminData(true)}
                      disabled={loading || refreshing}
                    >
                      {refreshing ? "Refreshing..." : "Refresh Data"}
                    </button>
                  </div>
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
              </div>
            )}

            {/* ═══ SUBMISSIONS TAB ═══ */}
            {activeTab === "submissions" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>Content Submissions</h2>
                    <p className={styles.adminTabSubtitle}>Manage community notes and reports.</p>
                  </div>
                  <div className={styles.tabActions}>
                    <button
                      className={`btn btn-secondary btn-sm ${styles.refreshBtn}`}
                      onClick={() => void loadAdminData(true)}
                      disabled={loading || refreshing}
                    >
                      {refreshing ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>
                </div>

                <div className={styles.panel}>
                  <div className={styles.controlRow}>
                    <label className={styles.searchWrap}>
                      <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                        Open Tracks Admin
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
                                    <button className={`btn btn-sm ${styles.approveBtn}`} onClick={() => void handleAction(note.id, "approve")} disabled={isNoteLocked(note.id)}>
                                      {isActionBusy(note.id, "approve") ? "Approving..." : "Approve"}
                                    </button>
                                    <button className={`btn btn-sm ${styles.rejectBtn}`} onClick={() => void handleAction(note.id, "reject")} disabled={isNoteLocked(note.id)}>
                                      {isActionBusy(note.id, "reject") ? "Rejecting..." : "Reject"}
                                    </button>
                                  </>
                                )}
                                <button className={`btn btn-sm ${styles.featureBtn}`} onClick={() => void handleAction(note.id, "feature", !note.featured)} disabled={isNoteLocked(note.id)}>
                                  {isActionBusy(note.id, "feature") ? "Updating..." : note.featured ? "Unfeature" : "Feature"}
                                </button>
                                <Link href={`/note/${note.id}`} className="btn btn-sm btn-ghost">Open</Link>
                                <button className={`btn btn-sm ${styles.deleteBtn}`} onClick={() => void handleDelete(note.id, note.title)} disabled={isNoteLocked(note.id)}>
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
            )}

            {/* ═══ CONFIG TAB ═══ */}
            {activeTab === "config" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>System Configuration</h2>
                    <p className={styles.adminTabSubtitle}>Manage automation, storage, and platform settings.</p>
                  </div>
                </div>

                {/* Automation */}
                <section className={styles.configSection}>
                  <div className={styles.templatesPanelHeader} style={{ cursor: "default", paddingBottom: 0 }}>
                    <div>
                      <span className={styles.templatesEyebrow}>Automation</span>
                      <h2 className={styles.templatesTitle}>Content Pipelines</h2>
                    </div>
                  </div>
                  <div className={styles.templatesBody} style={{ paddingTop: "16px" }}>
                    <div className={styles.headerActions} style={{ flexWrap: "wrap" }}>
                      <div className={styles.autoApproveToggle}>
                        <div className={styles.autoApproveInfo}>
                          <span className={styles.autoApproveLabel}>Auto-Approve</span>
                          <span className={styles.autoApproveHint}>
                            {autoApproveEnabled ? "All uploads are auto-approved" : "Uploads need manual review"}
                          </span>
                        </div>
                        <button
                          className={`${styles.toggleSwitch} ${autoApproveEnabled ? styles.toggleOn : ""}`}
                          onClick={() => void handleAutoApproveToggle()}
                          disabled={autoApproveToggling}
                          aria-pressed={autoApproveEnabled}
                        >
                          <span className={styles.toggleThumb} />
                        </button>
                      </div>
                      <div className={styles.curatedThresholdWrap}>
                        <div className={styles.autoApproveInfo}>
                          <span className={styles.autoApproveLabel}>Curated Views</span>
                          <span className={styles.autoApproveHint}>Min views to show in Curated Notes</span>
                        </div>
                        <div className={styles.thresholdInputGroup}>
                          <input type="number" min="1" className={styles.thresholdInput} value={curatedThreshold} onChange={(e) => setCuratedThreshold(e.target.value)} placeholder="500" />
                          <button
                            className={`btn btn-sm ${styles.thresholdSaveBtn}`}
                            disabled={thresholdSaving}
                            onClick={async () => {
                              setThresholdSaving(true);
                              try {
                                const res = await fetch("/api/admin/settings", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ key: "curated_views_threshold", value: curatedThreshold }),
                                });
                                if (!res.ok) throw new Error();
                              } catch {
                                setError("Failed to save threshold.");
                              } finally {
                                setThresholdSaving(false);
                              }
                            }}
                          >
                            {thresholdSaving ? "..." : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Storage */}
                <section className={styles.storagePanel}>
                  <div className={styles.storageHeader}>
                    <div>
                      <span className={styles.storageEyebrow}>Storage Routing</span>
                      <h2 className={styles.storageTitle}>{storageModeLabel}</h2>
                    </div>
                    <span className={styles.storageModeBadge}>
                      {storage?.mode === "onedrive" ? "Live: OneDrive" : "Live: Local"}
                    </span>
                  </div>
                  <p className={styles.storageNote}>
                    {storage?.note || "Workbook routing status will appear here after the admin check succeeds."}
                  </p>
                  {storage && (
                    <div className={styles.storageSignalRow}>
                      <span className={styles.storageSignalText}>{storageLiveStatus}</span>
                      <span className={`${styles.storageQueueBadge} ${pendingWorkbookCount > 0 ? styles.storageQueueWarn : ""}`}>
                        Pending queue: {pendingWorkbookCount}
                      </span>
                    </div>
                  )}
                  {storageError && <div className={styles.storageError}>{storageError}</div>}
                  {storage && (
                    <>
                      <div className={styles.storageRoutingList}>
                        {storage.workbooks.map((workbook) => (
                          <div key={`${workbook.key}-route`} className={styles.storageRoutingRow}>
                            <div className={styles.storageRoutingFlow}>
                              <span>{getStorageFlowLabel(workbook.key)}</span>
                              <strong>{workbook.label}</strong>
                            </div>
                            <code className={styles.storageRoutingTarget}>
                              {storage.mode === "onedrive" ? workbook.oneDrivePath : workbook.localPath}
                            </code>
                          </div>
                        ))}
                      </div>
                      <div className={styles.storageGrid}>
                        {storage.workbooks.map((workbook) => {
                          const liveSnapshot = storage.mode === "onedrive" ? workbook.remoteSnapshot : workbook.localSnapshot;
                          return (
                            <article key={workbook.key} className={styles.storageCard}>
                              <div className={styles.storageCardHeader}>
                                <div>
                                  <h3 className={styles.storageCardTitle}>{workbook.label}</h3>
                                  <p className={styles.storageCardPath}>{storage.mode === "onedrive" ? workbook.oneDrivePath : workbook.localPath}</p>
                                </div>
                                <span className={styles.storagePrimarySheet}>{workbook.primarySheet}</span>
                              </div>
                              <div className={styles.storageBadgeRow}>
                                {workbook.expectedSheets.map((sheet) => {
                                  const present = Boolean(liveSnapshot?.sheets.some((entry) => entry.name === sheet));
                                  return (
                                    <span key={`${workbook.key}-${sheet}`} className={`${styles.storageSheetBadge} ${present ? styles.storageSheetOk : styles.storageSheetMissing}`}>
                                      {sheet}
                                    </span>
                                  );
                                })}
                              </div>
                              <div className={styles.storageMetaGrid}>
                                <div className={styles.storageMetaItem}>
                                  <span className={styles.storageMetaLabel}>{storage.mode === "onedrive" ? "Live workbook" : "Local workbook"}</span>
                                  <strong className={styles.storageMetaValue}>{liveSnapshot?.exists ? formatBytes(liveSnapshot.sizeBytes) : "Not found"}</strong>
                                  <span className={styles.storageMetaHint}>
                                    {liveSnapshot?.exists ? `${liveSnapshot.sheets.length} sheet${liveSnapshot.sheets.length === 1 ? "" : "s"}` : storage.mode === "onedrive" ? "No live OneDrive snapshot yet" : "Workbook has not been created yet"}
                                  </span>
                                </div>
                                <div className={styles.storageMetaItem}>
                                  <span className={styles.storageMetaLabel}>Local mirror</span>
                                  <strong className={styles.storageMetaValue}>{workbook.localSnapshot.exists ? formatBytes(workbook.localSnapshot.sizeBytes) : "None"}</strong>
                                  <span className={styles.storageMetaHint}>
                                    {workbook.localSnapshot.exists ? `${workbook.localSnapshot.sheets.length} local sheet${workbook.localSnapshot.sheets.length === 1 ? "" : "s"}` : "No local mirror file"}
                                  </span>
                                </div>
                                <div className={styles.storageMetaItem}>
                                  <span className={styles.storageMetaLabel}>Pending fallback</span>
                                  <strong className={styles.storageMetaValue}>{workbook.pendingSnapshot.exists ? formatBytes(workbook.pendingSnapshot.sizeBytes) : "Clear"}</strong>
                                  <span className={styles.storageMetaHint}>{workbook.pendingSnapshot.exists ? "Workbook write is queued locally" : "No pending sync file"}</span>
                                </div>
                              </div>
                              <div className={styles.storageSheetsList}>
                                {(liveSnapshot?.sheets || []).map((sheet) => (
                                  <div key={`${workbook.key}-${sheet.name}`} className={styles.storageSheetRow}>
                                    <span>{sheet.name}</span>
                                    <span>{sheet.rows} rows</span>
                                  </div>
                                ))}
                                {(!liveSnapshot || liveSnapshot.sheets.length === 0) && (
                                  <div className={styles.storageSheetEmpty}>No sheet snapshot available yet.</div>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>

                {/* Share Templates */}
                <section className={styles.templatesPanel}>
                  <button className={styles.templatesPanelHeader} onClick={() => setTemplatesOpen(!templatesOpen)} aria-expanded={templatesOpen}>
                    <div>
                      <span className={styles.templatesEyebrow}>Social Sharing</span>
                      <h2 className={styles.templatesTitle}>Share Templates</h2>
                    </div>
                    <div className={styles.templatesPanelHeaderRight}>
                      {templatesSaved && <span className={styles.templatesSavedBadge}>✓ Saved</span>}
                      <span className={`${styles.templatesChevron} ${templatesOpen ? styles.templatesChevronOpen : ""}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </div>
                  </button>
                  {templatesOpen && (
                    <div className={styles.templatesBody}>
                      <p className={styles.templatesHint}>
                        Customize the share message for each platform. Use <code>{'{title}'}</code> for note title, <code>{'{url}'}</code> for note link, and <code>{'{category}'}</code> for the topic name. Leave empty to use defaults.
                      </p>
                      {([
                        { key: "x", label: "𝕏 (Twitter)", icon: "𝕏", placeholder: `I just uploaded "{title}" on xreso 📚\n\nxreso is a free, open-source library where devs share notes & resources — completely free.\n\n💡 No paywall. No sign-up wall. Just knowledge.\n\n{url}\n\n#xreso #{category} #LearnInPublic` },
                        { key: "linkedin", label: "LinkedIn", icon: "in", placeholder: `🎓 Knowledge shared = Knowledge multiplied\n\nI just contributed "{title}" on xreso — a fully free, open-source platform built for developers.\n\nWhat is xreso?\n→ Community-driven library of programming notes\n→ 100% free — no paywalls\n→ Open source\n→ Covering {category} and 20+ topics\n\nCheck it out: {url}\n\n#OpenSource #Programming #{category}` },
                        { key: "whatsapp", label: "WhatsApp", icon: "💬", placeholder: `Hey! 👋\n\nI just shared my {category} notes on *xreso*\n\n📚 "{title}"\n\nIt's completely free and open source.\n\nCheck it out: {url}` },
                        { key: "telegram", label: "Telegram", icon: "✈️", placeholder: `📚 Just uploaded "{title}" on xreso\n\n→ Free & open-source programming notes library\n→ No paywall, no sign-up required\n→ {category} + 20 other topics\n\n{url}` },
                      ] as const).map((platform) => (
                        <div key={platform.key} className={styles.templateField}>
                          <div className={styles.templateFieldHeader}>
                            <span className={styles.templatePlatformIcon}>{platform.icon}</span>
                            <label className={styles.templateFieldLabel}>{platform.label}</label>
                            <button className={`btn btn-sm ${styles.templateSaveBtn}`} onClick={() => void handleTemplateSave(platform.key)} disabled={templatesSaving}>Save</button>
                          </div>
                          <textarea
                            className={styles.templateTextarea}
                            rows={5}
                            placeholder={platform.placeholder}
                            value={shareTemplates[platform.key as keyof typeof shareTemplates]}
                            onChange={(e) => setShareTemplates((prev) => ({ ...prev, [platform.key]: e.target.value }))}
                          />
                        </div>
                      ))}
                      <div className={styles.templatesBulkActions}>
                        <button className={`btn btn-primary btn-sm ${styles.templateSaveAllBtn}`} onClick={() => void handleSaveAllTemplates()} disabled={templatesSaving}>
                          {templatesSaving ? "Saving..." : "Save All Templates"}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShareTemplates({ x: "", linkedin: "", whatsapp: "", telegram: "" })}>
                          Reset to Defaults
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
            {/* ═══ ADVANCED TRACKS TAB ═══ */}
            {activeTab === "advanced" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>Advanced Tracks</h2>
                    <p className={styles.adminTabSubtitle}>Manage cloud-native resources. Pending auto-approves after 3 days.</p>
                  </div>
                  <div className={styles.tabActions}>
                    <button className={`btn btn-secondary btn-sm ${styles.refreshBtn}`} onClick={() => void loadAdvData()} disabled={loading}>
                      Refresh
                    </button>
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}
                {advMessage && <div className={styles.advSuccess}>{advMessage}</div>}

                <div className={styles.statsGrid} style={{ marginBottom: "var(--space-2xl)" }}>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{advSummary.total}</span>
                    <span className={styles.statLabel}>Resources</span>
                  </div>
                  <div className={`${styles.statCard} ${advSummary.pending > 0 ? styles.statWarn : ""}`}>
                    <span className={styles.statValue}>{advSummary.pending}</span>
                    <span className={styles.statLabel}>Pending</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{advSummary.approved}</span>
                    <span className={styles.statLabel}>Approved</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{advSummary.featured}</span>
                    <span className={styles.statLabel}>Featured</span>
                  </div>
                </div>

                {/* Resource Queue */}
                <div className={styles.panel}>
                  <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-lg)", color: "var(--text-primary)" }}>Resource Queue</h3>
                  {advResources.length === 0 ? (
                    <div className={styles.empty}>No advanced resources yet.</div>
                  ) : (
                    <div className={styles.table}>
                      {advResources.map((resource) => {
                        const href = resource.content_url.startsWith("onedrive://") ? `/api/advanced-tracks/resource/${resource.id}` : resource.content_url;
                        return (
                          <article key={resource.id} className={styles.row}>
                            <div className={styles.rowMain}>
                              <div className={styles.rowInfo}>
                                <h3 className={styles.rowTitle}>{resource.title}</h3>
                                <div className={styles.rowMeta}>
                                  <span className={styles.metaPill}>{resource.track_name}</span>
                                  {resource.topic_name && <span>{resource.topic_name}</span>}
                                  <span>{resource.resource_type}</span>
                                  <span>{resource.author_name || "Unknown"}</span>
                                  <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className={styles.rowSide}>
                              <div className={styles.rowBadges}>
                                <span className={`${styles.statusBadge} ${resource.status === "approved" ? styles.statusApproved : resource.status === "pending" ? styles.statusPending : styles.statusRejected}`}>
                                  {getStatusLabel(resource.status)}
                                </span>
                                {Boolean(resource.featured) && <span className={styles.featuredBadge}>Featured</span>}
                              </div>
                              <div className={styles.rowActions}>
                                <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Open</a>
                                <button className={`btn btn-sm ${styles.approveBtn}`} onClick={() => void handleAdvAction(resource.id, "approve")}>Approve</button>
                                <button className={`btn btn-sm ${styles.rejectBtn}`} onClick={() => void handleAdvAction(resource.id, "reject")}>Reject</button>
                                <button className={`btn btn-sm ${styles.featureBtn}`} onClick={() => void handleAdvAction(resource.id, resource.featured ? "unfeature" : "feature")}>
                                  {resource.featured ? "Unfeature" : "Feature"}
                                </button>
                                <button className={`btn btn-sm ${styles.deleteBtn}`} onClick={() => void handleAdvDelete(resource.id)}>Delete</button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* ═══ REPORTS TAB ═══ */}
            {activeTab === "reports" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>Reports & Moderation</h2>
                    <p className={styles.adminTabSubtitle}>Manage community-flagged content. Notes reported by 3 different users are auto-rejected.</p>
                  </div>
                  <div className={styles.tabActions}>
                    <button className={`btn btn-secondary btn-sm ${styles.refreshBtn}`} onClick={() => void loadReports()} disabled={loading}>
                      Refresh
                    </button>
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.panel}>
                  {reports.length === 0 ? (
                    <div className={styles.empty}>Hooray! No pending reports.</div>
                  ) : (
                    <div className={styles.table}>
                      {reports.map((report) => (
                        <article key={report.note_id} className={styles.row}>
                          <div className={styles.rowMain}>
                            <div className={styles.rowInfo}>
                              <h3 className={styles.rowTitle}>{report.title}</h3>
                              <div className={styles.rowMeta}>
                                <span className={styles.metaPill}>Report Count: {report.report_count}</span>
                                <span>Note Status: {report.note_status}</span>
                                <span>Author: {report.author_name}</span>
                                <span>Reported: {new Date(report.last_reported_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className={styles.rowSide}>
                            <div className={styles.rowActions}>
                              <Link href={`/note/${report.note_id}`} className="btn btn-sm btn-ghost">Open Note</Link>
                              <button className={`btn btn-sm btn-secondary`} onClick={() => void handleDismissReport(report.note_id)}>Dismiss & Resolve</button>
                              <button className={`btn btn-sm ${styles.deleteBtn}`} onClick={() => void handleDelete(report.note_id, report.title)}>Delete Note</button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ USERS TAB ═══ */}
            {activeTab === "users" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>User & Role Management</h2>
                    <p className={styles.adminTabSubtitle}>{adminUsers.length} registered users. Assign roles or ban spammers.</p>
                  </div>
                  <div className={styles.tabActions}>
                    <button className={`btn btn-secondary btn-sm ${styles.refreshBtn}`} onClick={() => void loadUsers()}>Refresh</button>
                  </div>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.panel}>
                  <div className={styles.table}>
                    {adminUsers.map((user) => (
                      <article key={user.id} className={styles.row}>
                        <div className={styles.rowMain}>
                          <div className={styles.rowInfo}>
                            <h3 className={styles.rowTitle}>{user.name || "No Name"}</h3>
                            <div className={styles.rowMeta}>
                              <span>{user.email}</span>
                              <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                              <span>{user.note_count} notes</span>
                              <span>{user.total_views} views</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.rowSide}>
                          <div className={styles.rowBadges}>
                            <span className={`${styles.statusBadge} ${user.role === "admin" ? styles.statusApproved : user.role === "banned" ? styles.statusRejected : user.role === "moderator" ? styles.statusPending : ""}`}>
                              {user.role}
                            </span>
                          </div>
                          <div className={styles.rowActions}>
                            {user.role !== "admin" && (
                              <button className="btn btn-sm btn-ghost" disabled={roleChanging === user.id} onClick={() => void handleRoleChange(user.id, "admin")}>
                                Make Admin
                              </button>
                            )}
                            
                            {user.role === "admin" && user.email !== session?.user?.email && (
                              <button className="btn btn-sm btn-ghost" disabled={roleChanging === user.id} onClick={() => void handleRoleChange(user.id, "moderator")}>
                                Demote Admin
                              </button>
                            )}

                            {user.role !== "admin" && (
                              <button className="btn btn-sm btn-secondary" disabled={roleChanging === user.id} onClick={() => void handleRoleChange(user.id, "moderator")}>
                                Moderator
                              </button>
                            )}
                            
                            {user.role !== "admin" && user.role !== "banned" && (
                              <button className={`btn btn-sm ${styles.rejectBtn}`} disabled={roleChanging === user.id} onClick={() => void handleRoleChange(user.id, "banned")}>
                                Ban
                              </button>
                            )}
                            
                            {user.role === "banned" && (
                              <button className={`btn btn-sm ${styles.approveBtn}`} disabled={roleChanging === user.id} onClick={() => void handleRoleChange(user.id, "user")}>
                                Unban
                              </button>
                            )}

                            {user.email !== session?.user?.email && (
                              <button className="btn btn-sm btn-danger" style={{ color: "var(--color-danger)" }} disabled={roleChanging === user.id} onClick={() => void handleDeleteUser(user.id)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                    {adminUsers.length === 0 && <div className={styles.empty}>No users found.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ CATEGORIES TAB ═══ */}
            {activeTab === "taxonomy" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>Categories & Taxonomy</h2>
                    <p className={styles.adminTabSubtitle}>{adminCategories.length} categories with live note counts.</p>
                  </div>
                  <div className={styles.tabActions}>
                    <button className={`btn btn-secondary btn-sm ${styles.refreshBtn}`} onClick={() => void loadCategories()}>Refresh</button>
                  </div>
                </div>

                <div className={styles.panel}>
                  <div className={styles.table}>
                    {adminCategories.map((cat) => (
                      <article key={cat.id} className={styles.row}>
                        <div className={styles.rowMain}>
                          <div className={styles.rowInfo}>
                            <h3 className={styles.rowTitle}>
                              {cat.icon && <span style={{ marginRight: "8px" }}>{cat.icon}</span>}
                              {cat.name}
                            </h3>
                            <div className={styles.rowMeta}>
                              <span className={styles.metaPill}>/{cat.slug}</span>
                              <span>{cat.description || "No description"}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.rowSide}>
                          <div className={styles.rowBadges}>
                            <span className={styles.statusBadge}>{cat.noteCount} notes</span>
                          </div>
                        </div>
                      </article>
                    ))}
                    {adminCategories.length === 0 && <div className={styles.empty}>No categories found.</div>}
                  </div>
                </div>

                {/* Advanced Tracks & Topics */}
                {advTracks.length > 0 && (
                  <div className={styles.panel} style={{ marginTop: "var(--space-2xl)" }}>
                    <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-lg)", color: "var(--text-primary)" }}>Advanced Tracks</h3>
                    <div className={styles.table}>
                      {advTracks.map((track) => {
                        const trackTopics = advTopics.filter((t) => t.track_id === track.id);
                        return (
                          <article key={track.id} className={styles.row}>
                            <div className={styles.rowMain}>
                              <div className={styles.rowInfo}>
                                <h3 className={styles.rowTitle}>{track.name}</h3>
                                <div className={styles.rowMeta}>
                                  <span className={styles.metaPill}>/{track.slug}</span>
                                  <span>{track.description || "No description"}</span>
                                  <span>{trackTopics.length} topics</span>
                                </div>
                                {trackTopics.length > 0 && (
                                  <div className={styles.rowMeta} style={{ marginTop: "4px" }}>
                                    {trackTopics.map((topic) => (
                                      <span key={topic.id} className={styles.metaPill}>{topic.name} ({topic.level})</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ AUDIT LOGS TAB ═══ */}
            {activeTab === "audit" && (
              <div>
                <div className={styles.adminTabHeader}>
                  <div>
                    <h2 className={styles.adminTabTitle}>Audit Logs</h2>
                    <p className={styles.adminTabSubtitle}>Recent admin actions and system events.</p>
                  </div>
                  <div className={styles.tabActions}>
                    <button className={`btn btn-secondary btn-sm ${styles.refreshBtn}`} onClick={() => void loadAuditLogs()}>Refresh</button>
                  </div>
                </div>

                <div className={styles.panel}>
                  {auditLogs.length === 0 ? (
                    <div className={styles.empty}>No audit logs recorded yet. Actions will appear here as admins interact with the system.</div>
                  ) : (
                    <div className={styles.table}>
                      {auditLogs.map((log) => (
                        <article key={log.id} className={styles.row}>
                          <div className={styles.rowMain}>
                            <div className={styles.rowInfo}>
                              <h3 className={styles.rowTitle} style={{ fontSize: "var(--text-sm)" }}>
                                <strong>{log.admin_email}</strong>{" "}
                                <span className={styles.metaPill}>{log.action}</span>{" "}
                                {log.target_type && <span>on {log.target_type}</span>}
                              </h3>
                              <div className={styles.rowMeta}>
                                <span>{log.details || "No details"}</span>
                                <span>{new Date(log.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}

