"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

interface Resource {
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

interface ApiPayload {
  resources: Resource[];
}

type QueueAction = "approve" | "reject" | "feature" | "unfeature" | "delete";

export default function AdvancedTracksAdminPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceActions, setResourceActions] = useState<Record<string, QueueAction | null>>({});

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setMessage("");

    try {
      const advancedRes = await fetch("/api/admin/advanced-tracks", { cache: "no-store" });
      if (!advancedRes.ok) {
        const advancedPayload = (await advancedRes.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          advancedPayload?.error || "Failed to load open library admin data"
        );
      }

      const payload = (await advancedRes.json()) as ApiPayload;

      setResources(payload.resources || []);
    } catch (loadError) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Could not load open library admin data.");
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (role === "admin" || role === "moderator") {
      void loadData(false);
    }
  }, [loadData, role]);

  const summary = useMemo(
    () => ({
      total: resources.length,
      pending: resources.filter((resource) => resource.status === "pending").length,
      approved: resources.filter((resource) => resource.status === "approved").length,
      featured: resources.filter((resource) => Boolean(resource.featured)).length,
    }),
    [resources]
  );

  const handleAction = async (
    resourceId: string,
    action: "approve" | "reject" | "feature" | "unfeature"
  ) => {
    setResourceActions((prev) => ({ ...prev, [resourceId]: action }));
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/advanced-tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, action }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Action failed");
      }

      setMessage("Resource updated.");
      await loadData(true);
    } catch (actionError) {
      if (actionError instanceof Error) {
        setError(actionError.message);
      } else {
        setError("Action failed.");
      }
    } finally {
      setResourceActions((prev) => ({ ...prev, [resourceId]: null }));
    }
  };

  const handleDelete = async (resourceId: string) => {
    const confirmed = window.confirm("Delete this open resource permanently?");
    if (!confirmed) return;

    setResourceActions((prev) => ({ ...prev, [resourceId]: "delete" }));
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/advanced-tracks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Delete failed");
      }

      setMessage("Resource deleted.");
      await loadData(true);
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError("Delete failed.");
      }
    } finally {
      setResourceActions((prev) => ({ ...prev, [resourceId]: null }));
    }
  };

  const isResourceLocked = (resourceId: string) => Boolean(resourceActions[resourceId]);

  const isActionBusy = (resourceId: string, action: QueueAction) => {
    const activeAction = resourceActions[resourceId];
    if (!activeAction) return false;
    if (action === "feature") {
      return activeAction === "feature" || activeAction === "unfeature";
    }
    return activeAction === action;
  };

  if (status === "loading") {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loading}>Loading admin access...</div>
        </div>
      </div>
    );
  }

  if (!session?.user || (role !== "admin" && role !== "moderator")) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.denied}>
            <h2>Access Denied</h2>
            <p>You need admin or moderator privileges to manage the open tracks library.</p>
            <Link href="/admin" className="btn btn-primary">
              Back to Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Open Library</p>
            <h1 className={styles.title}>Tracks Admin</h1>
            <p className={styles.subtitle}>
              Manage cloud-native resources, keep the queue healthy, and auto-publish
              pending submissions after 3 days.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Standard Notes Admin
            </Link>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void loadData(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <section className={styles.noticeBar}>
          <strong>Open access is live.</strong>
          <span>
            Every advanced resource is public by default, and pending submissions are
            auto-approved after 3 days.
          </span>
        </section>

        <section className={styles.overviewGrid}>
          <article className={styles.overviewCard}>
            <span className={styles.overviewLabel}>Resources</span>
            <strong className={styles.overviewValue}>{summary.total}</strong>
          </article>
          <article className={styles.overviewCard}>
            <span className={styles.overviewLabel}>Pending</span>
            <strong className={styles.overviewValue}>{summary.pending}</strong>
          </article>
          <article className={styles.overviewCard}>
            <span className={styles.overviewLabel}>Approved</span>
            <strong className={styles.overviewValue}>{summary.approved}</strong>
          </article>
          <article className={styles.overviewCard}>
            <span className={styles.overviewLabel}>Featured</span>
            <strong className={styles.overviewValue}>{summary.featured}</strong>
          </article>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Open Resource Queue</h2>

          {loading ? (
            <div className={styles.loading}>Loading resources...</div>
          ) : resources.length === 0 ? (
            <div className={styles.empty}>No advanced resources found yet.</div>
          ) : (
            <div className={styles.resourceList}>
              {resources.map((resource) => {
                const resourceHref = `/note/${resource.id}?mode=advanced`;

                return (
                  <article key={resource.id} className={styles.resourceRow}>
                    <div className={styles.resourceInfo}>
                      <h3 className={styles.resourceTitle}>{resource.title}</h3>
                      <p className={styles.resourceSummary}>{resource.summary}</p>
                      <div className={styles.resourceMeta}>
                        <span>{resource.track_name}</span>
                        {resource.topic_name ? <span>{resource.topic_name}</span> : null}
                        <span>{resource.resource_type}</span>
                        <span>{resource.author_name || "Unknown author"}</span>
                        <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className={styles.badges}>
                        <span
                          className={`${styles.badge} ${styles[`status_${resource.status}`] || ""}`}
                        >
                          {resource.status}
                        </span>
                        <span className={styles.badge}>open access</span>
                        {Boolean(resource.featured) && (
                          <span className={styles.badge}>featured</span>
                        )}
                        {resource.status === "pending" && (
                          <span className={styles.badge}>auto-approve after 3d</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.resourceActions}>
                      <Link href={resourceHref} className="btn btn-ghost btn-sm">
                        Open
                      </Link>
                      {resource.status === "pending" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleAction(resource.id, "approve")}
                          disabled={isResourceLocked(resource.id)}
                        >
                          {isActionBusy(resource.id, "approve") ? "Approving..." : "Approve"}
                        </button>
                      )}
                      {resource.status === "pending" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleAction(resource.id, "reject")}
                          disabled={isResourceLocked(resource.id)}
                        >
                          {isActionBusy(resource.id, "reject") ? "Rejecting..." : "Reject"}
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          void handleAction(
                            resource.id,
                            resource.featured ? "unfeature" : "feature"
                          )
                        }
                        disabled={isResourceLocked(resource.id)}
                      >
                        {isActionBusy(resource.id, "feature")
                          ? "Updating..."
                          : resource.featured
                            ? "Unfeature"
                            : "Feature"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void handleDelete(resource.id)}
                        disabled={isResourceLocked(resource.id)}
                      >
                        {isActionBusy(resource.id, "delete") ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
