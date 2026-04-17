"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import UnifiedDropdown from "@/components/UnifiedDropdown/UnifiedDropdown";
import styles from "./page.module.css";

interface Track {
  id: number;
  slug: string;
  name: string;
  description: string;
}

interface Topic {
  id: number;
  track_id: number;
  slug: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

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
  tracks: Track[];
  topics: Topic[];
  resources: Resource[];
}

const INITIAL_FORM = {
  title: "",
  summary: "",
  trackSlug: "",
  topicSlug: "",
  resourceType: "link" as "link" | "pdf" | "doc" | "video",
  contentUrl: "",
  thumbnailUrl: "",
  tags: "",
  status: "pending" as "draft" | "pending" | "approved",
  premiumOnly: false,
  featured: false,
};

export default function AdvancedTracksAdminPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tracks, setTracks] = useState<Track[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [form, setForm] = useState(INITIAL_FORM);

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

      setTracks(payload.tracks || []);
      setTopics(payload.topics || []);
      setResources(payload.resources || []);
      setForm((prev) => {
        if (prev.trackSlug || !payload.tracks?.length) {
          return prev;
        }

        return { ...prev, trackSlug: payload.tracks[0].slug };
      });
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

  const scopedTopics = useMemo(() => {
    if (!form.trackSlug) return [];
    const selectedTrack = tracks.find((track) => track.slug === form.trackSlug);
    if (!selectedTrack) return [];
    return topics.filter((topic) => topic.track_id === selectedTrack.id);
  }, [form.trackSlug, topics, tracks]);

  const summary = useMemo(
    () => ({
      total: resources.length,
      pending: resources.filter((resource) => resource.status === "pending").length,
      approved: resources.filter((resource) => resource.status === "approved").length,
      featured: resources.filter((resource) => Boolean(resource.featured)).length,
    }),
    [resources]
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/advanced-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          premiumOnly: false,
          tags: form.tags,
          topicSlug: form.topicSlug || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Create request failed");
      }

      setMessage("Open resource created successfully.");
      setForm((prev) => ({
        ...INITIAL_FORM,
        trackSlug: prev.trackSlug,
      }));
      await loadData(true);
    } catch (createError) {
      if (createError instanceof Error) {
        setError(createError.message);
      } else {
        setError("Failed to create open resource.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (
    resourceId: string,
    action: "approve" | "reject" | "archive" | "feature" | "unfeature"
  ) => {
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

      await loadData(true);
    } catch (actionError) {
      if (actionError instanceof Error) {
        setError(actionError.message);
      } else {
        setError("Action failed.");
      }
    }
  };

  const handleDelete = async (resourceId: string) => {
    const confirmed = window.confirm("Delete this open resource permanently?");
    if (!confirmed) return;

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

      await loadData(true);
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError("Delete failed.");
      }
    }
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
          <h2 className={styles.panelTitle}>Create Open Resource</h2>
          <form className={styles.formGrid} onSubmit={handleCreate}>
            <label className={styles.field}>
              <span>Track</span>
              <UnifiedDropdown
                value={form.trackSlug}
                title="Track"
                placeholder="Select track"
                options={tracks.map((track) => ({ value: track.slug, label: track.name }))}
                onChange={(selectedTrackSlug) =>
                  setForm((prev) => ({
                    ...prev,
                    trackSlug: selectedTrackSlug,
                    topicSlug: "",
                  }))
                }
                required
              />
            </label>

            <label className={styles.field}>
              <span>Topic (optional)</span>
              <UnifiedDropdown
                value={form.topicSlug}
                title="Topic"
                placeholder="All topics"
                options={scopedTopics.map((topic) => ({ value: topic.slug, label: topic.name }))}
                onChange={(nextTopicSlug) =>
                  setForm((prev) => ({ ...prev, topicSlug: nextTopicSlug }))
                }
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Summary</span>
              <textarea
                rows={3}
                value={form.summary}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, summary: event.target.value }))
                }
                required
              />
            </label>

            <label className={styles.field}>
              <span>Resource Type</span>
              <UnifiedDropdown
                value={form.resourceType}
                title="Resource Type"
                placeholder="Select resource type"
                options={[
                  { value: "link", label: "Link" },
                  { value: "pdf", label: "PDF" },
                  { value: "doc", label: "Doc" },
                  { value: "video", label: "Video" },
                ]}
                onChange={(nextResourceType) =>
                  setForm((prev) => ({
                    ...prev,
                    resourceType: nextResourceType as "link" | "pdf" | "doc" | "video",
                  }))
                }
              />
            </label>

            <label className={styles.field}>
              <span>Initial Status</span>
              <UnifiedDropdown
                value={form.status}
                title="Initial Status"
                placeholder="Select status"
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "draft", label: "Draft" },
                ]}
                onChange={(nextStatus) =>
                  setForm((prev) => ({
                    ...prev,
                    status: nextStatus as "draft" | "pending" | "approved",
                  }))
                }
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Content URL</span>
              <input
                type="url"
                value={form.contentUrl}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contentUrl: event.target.value }))
                }
                placeholder="https://..."
                required
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Thumbnail URL (optional)</span>
              <input
                type="url"
                value={form.thumbnailUrl}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))
                }
                placeholder="https://..."
              />
            </label>

            <label className={styles.fieldWide}>
              <span>Tags (comma separated)</span>
              <input
                type="text"
                value={form.tags}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, tags: event.target.value }))
                }
                placeholder="kubernetes, sre, observability"
              />
            </label>

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, featured: event.target.checked }))
                }
              />
              <span>Featured resource</span>
            </label>

            <div className={styles.openAccessHint}>
              New advanced resources are saved as open access. No extra unlock step is required.
            </div>

            <div className={styles.formActions}>
              <button className="btn btn-primary" type="submit" disabled={saving || loading}>
                {saving ? "Saving..." : "Create Resource"}
              </button>
            </div>
          </form>
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
                const resourceHref = resource.content_url.startsWith("onedrive://")
                  ? `/api/advanced-tracks/resource/${resource.id}`
                  : resource.content_url;

                return (
                  <article key={resource.id} className={styles.resourceRow}>
                    <div className={styles.resourceInfo}>
                      <h3 className={styles.resourceTitle}>{resource.title}</h3>
                      <p className={styles.resourceSummary}>{resource.summary}</p>
                      <div className={styles.resourceMeta}>
                        <span>{resource.track_name}</span>
                        {resource.topic_name ? <span>{resource.topic_name}</span> : null}
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
                      <a
                        href={resourceHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        Open
                      </a>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleAction(resource.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleAction(resource.id, "reject")}
                      >
                        Reject
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          void handleAction(
                            resource.id,
                            resource.featured ? "unfeature" : "feature"
                          )
                        }
                      >
                        {resource.featured ? "Unfeature" : "Feature"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void handleDelete(resource.id)}
                      >
                        Delete
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
