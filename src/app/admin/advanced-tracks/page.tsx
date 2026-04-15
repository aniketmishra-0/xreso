"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

interface EntitlementUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "moderator";
  premiumAccess: boolean;
  premiumExpiresAt: string | null;
  premiumActive: boolean;
  createdAt: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
  premiumOnly: true,
  featured: false,
};

export default function AdvancedTracksAdminPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tracks, setTracks] = useState<Track[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [entitlementUsers, setEntitlementUsers] = useState<EntitlementUser[]>([]);
  const [updatingEntitlementId, setUpdatingEntitlementId] = useState<string | null>(null);
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
      const [advancedRes, entitlementsRes] = await Promise.all([
        fetch("/api/admin/advanced-tracks", { cache: "no-store" }),
        fetch("/api/admin/entitlements", { cache: "no-store" }),
      ]);

      if (!advancedRes.ok || !entitlementsRes.ok) {
        const advancedPayload = (await advancedRes
          .json()
          .catch(() => null)) as { error?: string } | null;
        const entitlementsPayload = (await entitlementsRes
          .json()
          .catch(() => null)) as { error?: string } | null;

        throw new Error(
          advancedPayload?.error ||
            entitlementsPayload?.error ||
            "Failed to load advanced track admin data"
        );
      }

      const payload = (await advancedRes.json()) as ApiPayload;
      const entitlements = (await entitlementsRes.json()) as {
        users?: EntitlementUser[];
      };

      setTracks(payload.tracks || []);
      setTopics(payload.topics || []);
      setResources(payload.resources || []);
      setEntitlementUsers(entitlements.users || []);

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
        setError("Could not load advanced tracks admin data.");
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
          tags: form.tags,
          topicSlug: form.topicSlug || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Create request failed");
      }

      setMessage("Advanced resource created successfully.");
      setForm((prev) => ({
        ...INITIAL_FORM,
        trackSlug: prev.trackSlug,
      }));
      await loadData(true);
    } catch (createError) {
      if (createError instanceof Error) {
        setError(createError.message);
      } else {
        setError("Failed to create advanced resource.");
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

  const handleEntitlementUpdate = async (
    userId: string,
    premiumAccess: boolean,
    premiumExpiresAt: string | null
  ) => {
    setError("");
    setMessage("");
    setUpdatingEntitlementId(userId);

    try {
      const response = await fetch("/api/admin/entitlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, premiumAccess, premiumExpiresAt }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update entitlement");
      }

      setMessage("Premium entitlement updated.");
      await loadData(true);
    } catch (entitlementError) {
      if (entitlementError instanceof Error) {
        setError(entitlementError.message);
      } else {
        setError("Failed to update entitlement.");
      }
    } finally {
      setUpdatingEntitlementId(null);
    }
  };

  const handleDelete = async (resourceId: string) => {
    const confirmed = window.confirm("Delete this advanced resource permanently?");
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

  if (!session?.user || (role !== "admin" && role !== "moderator")) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.denied}>
            <h2>Access Denied</h2>
            <p>You need admin or moderator privileges to manage advanced tracks.</p>
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
            <p className={styles.eyebrow}>Premium Module</p>
            <h1 className={styles.title}>Advanced Tracks Admin</h1>
            <p className={styles.subtitle}>
              Dedicated upload and moderation flow for cloud-native premium resources.
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

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Create Advanced Resource</h2>
          <form className={styles.formGrid} onSubmit={handleCreate}>
            <label className={styles.field}>
              <span>Track</span>
              <select
                value={form.trackSlug}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    trackSlug: event.target.value,
                    topicSlug: "",
                  }))
                }
                required
              >
                <option value="">Select track</option>
                {tracks.map((track) => (
                  <option key={track.slug} value={track.slug}>
                    {track.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Topic (optional)</span>
              <select
                value={form.topicSlug}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, topicSlug: event.target.value }))
                }
              >
                <option value="">All topics</option>
                {scopedTopics.map((topic) => (
                  <option key={topic.slug} value={topic.slug}>
                    {topic.name}
                  </option>
                ))}
              </select>
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
              <select
                value={form.resourceType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    resourceType: event.target.value as "link" | "pdf" | "doc" | "video",
                  }))
                }
              >
                <option value="link">Link</option>
                <option value="pdf">PDF</option>
                <option value="doc">Doc</option>
                <option value="video">Video</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Initial Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value as "draft" | "pending" | "approved",
                  }))
                }
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="draft">Draft</option>
              </select>
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
                checked={form.premiumOnly}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, premiumOnly: event.target.checked }))
                }
              />
              <span>Premium only</span>
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

            <div className={styles.formActions}>
              <button className="btn btn-primary" type="submit" disabled={saving || loading}>
                {saving ? "Saving..." : "Create Resource"}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Premium Access Control</h2>

          {loading ? (
            <div className={styles.loading}>Loading member entitlements...</div>
          ) : entitlementUsers.length === 0 ? (
            <div className={styles.empty}>No members found.</div>
          ) : (
            <div className={styles.memberList}>
              {entitlementUsers.map((member) => {
                const expiresLabel = member.premiumExpiresAt
                  ? new Date(member.premiumExpiresAt).toLocaleDateString()
                  : member.premiumAccess
                    ? "Lifetime"
                    : "Free tier";
                const grantThirtyDaysAt = new Date(
                  Date.now() + THIRTY_DAYS_MS
                ).toISOString();

                return (
                  <article key={member.id} className={styles.memberRow}>
                    <div className={styles.memberInfo}>
                      <h3 className={styles.memberName}>{member.name}</h3>
                      <p className={styles.memberMeta}>
                        {member.email} • {member.role}
                      </p>
                      <div className={styles.badges}>
                        <span
                          className={`${styles.badge} ${
                            member.premiumActive
                              ? styles.status_approved
                              : styles.status_pending
                          }`}
                        >
                          {member.premiumActive ? "premium active" : "premium inactive"}
                        </span>
                        <span className={styles.badge}>{expiresLabel}</span>
                      </div>
                    </div>

                    {role === "admin" ? (
                      <div className={styles.memberActions}>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={updatingEntitlementId === member.id}
                          onClick={() =>
                            void handleEntitlementUpdate(member.id, true, null)
                          }
                        >
                          Lifetime
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={updatingEntitlementId === member.id}
                          onClick={() =>
                            void handleEntitlementUpdate(
                              member.id,
                              true,
                              grantThirtyDaysAt
                            )
                          }
                        >
                          +30 Days
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={updatingEntitlementId === member.id}
                          onClick={() =>
                            void handleEntitlementUpdate(member.id, false, null)
                          }
                        >
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <p className={styles.memberReadonly}>Moderator view</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Advanced Resource Queue</h2>

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
                      <span className={`${styles.badge} ${styles[`status_${resource.status}`] || ""}`}>
                        {resource.status}
                      </span>
                      {Boolean(resource.premium_only) && <span className={styles.badge}>premium</span>}
                      {Boolean(resource.featured) && <span className={styles.badge}>featured</span>}
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
