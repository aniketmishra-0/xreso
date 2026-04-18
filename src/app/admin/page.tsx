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

interface StorageStatus {
  mode: "local" | "onedrive";
  note: string;
  workbooks: StorageWorkbook[];
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
        share_template_x?: string;
        share_template_linkedin?: string;
        share_template_whatsapp?: string;
        share_template_telegram?: string;
      } }) => {
        setAutoApproveEnabled(data.settings?.auto_approve_enabled ?? false);
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
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Admin Command Center</h1>
            <p className={styles.subtitle}>
              Review submissions, curate featured notes, and monitor library health.
            </p>
          </div>
          <div className={styles.headerActions}>
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
                aria-label="Toggle auto-approval"
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
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
                  <span
                    className={`${styles.storageQueueBadge} ${
                      pendingWorkbookCount > 0 ? styles.storageQueueWarn : ""
                    }`}
                  >
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
                      const liveSnapshot =
                        storage.mode === "onedrive"
                          ? workbook.remoteSnapshot
                          : workbook.localSnapshot;

                      return (
                        <article key={workbook.key} className={styles.storageCard}>
                          <div className={styles.storageCardHeader}>
                            <div>
                              <h3 className={styles.storageCardTitle}>{workbook.label}</h3>
                              <p className={styles.storageCardPath}>
                                {storage.mode === "onedrive"
                                  ? workbook.oneDrivePath
                                  : workbook.localPath}
                              </p>
                            </div>
                            <span className={styles.storagePrimarySheet}>
                              {workbook.primarySheet}
                            </span>
                          </div>

                          <div className={styles.storageBadgeRow}>
                            {workbook.expectedSheets.map((sheet) => {
                              const present = Boolean(
                                liveSnapshot?.sheets.some((entry) => entry.name === sheet)
                              );

                              return (
                                <span
                                  key={`${workbook.key}-${sheet}`}
                                  className={`${styles.storageSheetBadge} ${
                                    present ? styles.storageSheetOk : styles.storageSheetMissing
                                  }`}
                                >
                                  {sheet}
                                </span>
                              );
                            })}
                          </div>

                          <div className={styles.storageMetaGrid}>
                            <div className={styles.storageMetaItem}>
                              <span className={styles.storageMetaLabel}>
                                {storage.mode === "onedrive" ? "Live workbook" : "Local workbook"}
                              </span>
                              <strong className={styles.storageMetaValue}>
                                {liveSnapshot?.exists ? formatBytes(liveSnapshot.sizeBytes) : "Not found"}
                              </strong>
                              <span className={styles.storageMetaHint}>
                                {liveSnapshot?.exists
                                  ? `${liveSnapshot.sheets.length} sheet${liveSnapshot.sheets.length === 1 ? "" : "s"}`
                                  : storage.mode === "onedrive"
                                    ? "No live OneDrive snapshot yet"
                                    : "Workbook has not been created yet"}
                              </span>
                            </div>

                            <div className={styles.storageMetaItem}>
                              <span className={styles.storageMetaLabel}>Local mirror</span>
                              <strong className={styles.storageMetaValue}>
                                {workbook.localSnapshot.exists
                                  ? formatBytes(workbook.localSnapshot.sizeBytes)
                                  : "None"}
                              </strong>
                              <span className={styles.storageMetaHint}>
                                {workbook.localSnapshot.exists
                                  ? `${workbook.localSnapshot.sheets.length} local sheet${workbook.localSnapshot.sheets.length === 1 ? "" : "s"}`
                                  : "No local mirror file"}
                              </span>
                            </div>

                            <div className={styles.storageMetaItem}>
                              <span className={styles.storageMetaLabel}>Pending fallback</span>
                              <strong className={styles.storageMetaValue}>
                                {workbook.pendingSnapshot.exists
                                  ? formatBytes(workbook.pendingSnapshot.sizeBytes)
                                  : "Clear"}
                              </strong>
                              <span className={styles.storageMetaHint}>
                                {workbook.pendingSnapshot.exists
                                  ? "Workbook write is queued locally"
                                  : "No pending sync file"}
                              </span>
                            </div>
                          </div>

                          <div className={styles.storageSheetsList}>
                            {(liveSnapshot?.sheets || []).map((sheet) => (
                              <div
                                key={`${workbook.key}-${sheet.name}`}
                                className={styles.storageSheetRow}
                              >
                                <span>{sheet.name}</span>
                                <span>{sheet.rows} rows</span>
                              </div>
                            ))}

                            {(!liveSnapshot || liveSnapshot.sheets.length === 0) && (
                              <div className={styles.storageSheetEmpty}>
                                No sheet snapshot available yet.
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {/* ── Share Templates Editor ─── */}
        <section className={styles.templatesPanel}>
          <button
            className={styles.templatesPanelHeader}
            onClick={() => setTemplatesOpen(!templatesOpen)}
            aria-expanded={templatesOpen}
          >
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
                    <button
                      className={`btn btn-sm ${styles.templateSaveBtn}`}
                      onClick={() => void handleTemplateSave(platform.key)}
                      disabled={templatesSaving}
                    >
                      Save
                    </button>
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
                <button
                  className={`btn btn-primary btn-sm ${styles.templateSaveAllBtn}`}
                  onClick={() => void handleSaveAllTemplates()}
                  disabled={templatesSaving}
                >
                  {templatesSaving ? "Saving..." : "Save All Templates"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShareTemplates({ x: "", linkedin: "", whatsapp: "", telegram: "" })}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}
        </section>

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
