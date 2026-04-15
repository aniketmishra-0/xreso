"use client";

import Image from "next/image";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORY_CATALOG } from "@/lib/techIcons";
import styles from "./page.module.css";

/* ── Link type helper ─────────────────────── */
function detectLinkType(url: string): { label: string; icon: string } {
  if (!url) return { label: "Resource Link", icon: "🔗" };
  if (url.includes("drive.google.com") || url.includes("docs.google.com")) return { label: "Google Drive", icon: "📁" };
  if (url.includes("github.com")) return { label: "GitHub", icon: "🐙" };
  if (url.includes("youtube.com") || url.includes("youtu.be")) return { label: "YouTube", icon: "▶️" };
  if (url.includes("notion.so")) return { label: "Notion", icon: "📝" };
  if (url.includes("dropbox.com")) return { label: "Dropbox", icon: "📦" };
  if (url.includes("figma.com")) return { label: "Figma", icon: "🎨" };
  if (url.includes("medium.com") || url.includes("dev.to") || url.includes("hashnode")) return { label: "Blog Article", icon: "✍️" };
  return { label: "External Resource", icon: "🌐" };
}

/* Build label/badge maps from the full catalog */
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_CATALOG.map(cat => [cat.slug, cat.name])
);

const STANDARD_CATEGORY_CATALOG = CATEGORY_CATALOG.filter(
  (cat) => cat.slug !== "devops"
);

const BADGE_COLOR_MAP: Record<string, string> = {
  python: "badge-blue", javascript: "badge-yellow", sql: "badge-green",
  java: "badge-purple", typescript: "badge-blue", react: "badge-blue",
  go: "badge-blue", rust: "badge-orange", swift: "badge-orange",
  kotlin: "badge-purple", ruby: "badge-orange", php: "badge-purple",
  "data-structures": "badge-green", algorithms: "badge-pink",
};

const CATEGORY_BADGE: Record<string, string> = Object.fromEntries(
  CATEGORY_CATALOG.map(cat => [cat.slug, BADGE_COLOR_MAP[cat.slug] || ""])
);

const INITIAL_FORM_DATA = {
  title: "",
  description: "",
  category: "",
  advancedTrackSlug: "",
  advancedTopicSlug: "",
  advancedResourceType: "link",
  tags: "",
  authorCredit: "",
  resourceUrl: "",
  sourceUrl: "",
  licenseType: "CC-BY-4.0",
};

interface AdvancedTrackTopic {
  id: number;
  slug: string;
  name: string;
  description: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

interface AdvancedTrack {
  id: number;
  slug: string;
  name: string;
  description: string;
  premium: boolean;
  approvedCount: number;
  topics: AdvancedTrackTopic[];
}

/* ──────────────────────────────────────────────────────────
   PREVIEW DRAWER — renders live as user fills the form
──────────────────────────────────────────────────────────── */
interface PreviewProps {
  open: boolean;
  onClose: () => void;
  resourceTier: "standard" | "advanced";
  advancedTracks: AdvancedTrack[];
  mode: "file" | "link";
  fileObjectUrl: string;
  formData: {
    title: string; description: string; category: string;
    advancedTrackSlug: string;
    tags: string; authorCredit: string; resourceUrl: string; licenseType: string;
  };
  session: { user?: { name?: string | null } } | null;
}

function PreviewDrawer({ open, onClose, resourceTier, advancedTracks, mode, fileObjectUrl, formData, session }: PreviewProps) {
  const tagList = formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  const authorName = formData.authorCredit || session?.user?.name || "You";
  const selectedTrack = advancedTracks.find((track) => track.slug === formData.advancedTrackSlug);
  const catLabel =
    resourceTier === "advanced"
      ? selectedTrack?.name || formData.advancedTrackSlug || "Advanced Track"
      : CATEGORY_LABELS[formData.category] || formData.category || "Category";
  const catBadge = resourceTier === "advanced" ? "badge-blue" : CATEGORY_BADGE[formData.category] || "";
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const linkMeta = detectLinkType(formData.resourceUrl);

  const hasContent = formData.title || formData.description || fileObjectUrl || formData.resourceUrl;

  return (
    <>
      {/* Overlay */}
      <div
        className={`${styles.previewOverlay} ${open ? styles.previewOverlayOpen : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className={`${styles.previewDrawer} ${open ? styles.previewDrawerOpen : ""}`} role="dialog" aria-modal="true" aria-label="Note Preview">
        {/* Header */}
        <div className={styles.previewHeader}>
          <div className={styles.previewHeaderLeft}>
            <span className={styles.previewHeaderDot} />
            <h2 className={styles.previewTitle}>Live Preview</h2>
            <span className={styles.previewBadge}>DRAFT</span>
          </div>
          <button className={styles.previewClose} onClick={onClose} id="preview-close-btn" aria-label="Close preview">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className={styles.previewBody}>
          {!hasContent ? (
            <div className={styles.previewEmpty}>
              <div className={styles.previewEmptyIcon}>👁️</div>
              <p className={styles.previewEmptyText}>Fill in the form to see a live preview of your note</p>
            </div>
          ) : (
            <>
              {/* ── CARD VIEW ──────────────────────────── */}
              <div className={styles.previewSection}>
                <p className={styles.previewSectionLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  Grid Card View
                </p>
                <div className={styles.previewCard}>
                  {/* Thumbnail */}
                    <div className={styles.previewCardThumb}>
                      {mode === "file" && fileObjectUrl ? (
                        <Image
                          src={fileObjectUrl}
                          alt="Preview"
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 100vw, 420px"
                          className={styles.previewCardImg}
                        />
                      ) : mode === "link" && formData.resourceUrl ? (
                        <div className={styles.previewCardLinkThumb}>
                          <span className={styles.previewCardLinkIcon}>{linkMeta.icon}</span>
                        <span className={styles.previewCardLinkLabel}>{linkMeta.label}</span>
                      </div>
                    ) : (
                      <div className={styles.previewCardPlaceholderThumb}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                    )}
                    <div className={styles.previewCardOverlay}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <span>View Notes</span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className={styles.previewCardBody}>
                    <div className={styles.previewCardMeta}>
                      <span className={`badge ${catBadge}`}>{catLabel}</span>
                      <span className={styles.previewCardDate}>{today}</span>
                    </div>
                    <h3 className={styles.previewCardTitle}>{formData.title || "Your Note Title"}</h3>
                    <p className={styles.previewCardDesc}>{formData.description || "Your description will appear here…"}</p>
                    {tagList.length > 0 && (
                      <div className={styles.previewCardTags}>
                        {tagList.slice(0, 3).map(tag => (
                          <span key={tag} className={styles.previewCardTag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className={styles.previewCardFooter}>
                      <div className={styles.previewCardAuthor}>
                        <div className={styles.previewCardAvatar}>{authorName.charAt(0).toUpperCase()}</div>
                        <span className={styles.previewCardAuthorName}>{authorName}</span>
                      </div>
                      <div className={styles.previewCardStats}>
                        <span className={styles.previewCardStat}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> 0
                        </span>
                        <span className={styles.previewCardStat}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> 0
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── DETAIL VIEW ────────────────────────── */}
              <div className={styles.previewSection}>
                <p className={styles.previewSectionLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Detail Page Preview
                </p>

                {/* File viewer or link resource */}
                {mode === "file" && fileObjectUrl && (
                  <div className={styles.previewViewer}>
                    <div className={styles.previewViewerMedia}>
                      <Image
                        src={fileObjectUrl}
                        alt="File preview"
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 420px"
                        className={styles.previewViewerImg}
                      />
                    </div>
                    <div className={styles.previewViewerBar}>
                      <span className={styles.previewViewerHint}>← Actual file as it appears to viewers</span>
                    </div>
                  </div>
                )}

                {mode === "link" && formData.resourceUrl && (
                  <div className={styles.previewResourceCard}>
                    <span className={styles.previewResourceIcon}>{linkMeta.icon}</span>
                    <div className={styles.previewResourceInfo}>
                      <span className={styles.previewResourceLabel}>{linkMeta.label}</span>
                      <span className={styles.previewResourceOpen}>Open Resource →</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </div>
                )}

                {/* Sidebar preview */}
                <div className={styles.previewSidebar}>
                  <div className={styles.previewSideSection}>
                    <span className={`badge ${catBadge}`}>{catLabel}</span>
                    <h4 className={styles.previewSideTitle}>{formData.title || "Your Note Title"}</h4>
                    <p className={styles.previewSideDesc}>{formData.description || "Description will appear here."}</p>
                  </div>

                  <div className={styles.previewSideSection}>
                    <p className={styles.previewSideLabel}>Author</p>
                    <div className={styles.previewSideAuthor}>
                      <div className={styles.previewSideAvatar}>{authorName.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className={styles.previewSideAuthorName}>{authorName}</p>
                        <p className={styles.previewSideDate}>Published {today}</p>
                      </div>
                    </div>
                  </div>

                  {tagList.length > 0 && (
                    <div className={styles.previewSideSection}>
                      <p className={styles.previewSideLabel}>Tags</p>
                      <div className={styles.previewSideTags}>
                        {tagList.map(tag => (
                          <span key={tag} className={styles.previewSideTag}>#{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.previewSideSection}>
                    <p className={styles.previewSideLabel}>License</p>
                    <span className={styles.previewSideLicense}>{formData.licenseType || "CC-BY-4.0"}</span>
                  </div>
                </div>
              </div>

              {/* Pending notice */}
              <div className={styles.previewPending}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Your note will be <strong>reviewed by moderators</strong> before going live.
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/* ──────────────────────────────────────────────────────────
   MAIN UPLOAD PAGE
──────────────────────────────────────────────────────────── */
export default function UploadPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionUser = session?.user as { name?: string | null; role?: string } | undefined;
  const sessionName = sessionUser?.name ?? "";
  const userRole = sessionUser?.role;
  const canAccessAdvancedUpload = userRole === "admin" || userRole === "moderator";

  const [resourceTier, setResourceTier] = useState<"standard" | "advanced">("standard");
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [advancedTracks, setAdvancedTracks] = useState<AdvancedTrack[]>([]);
  const [advancedCatalogLoading, setAdvancedCatalogLoading] = useState(false);
  const [advancedCatalogError, setAdvancedCatalogError] = useState("");

  const [checks, setChecks] = useState({ ownership: false, license: false, tos: false });
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileObjectUrl, setFileObjectUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; noteId?: string } | null>(null);

  const selectedAdvancedTrack = advancedTracks.find(
    (track) => track.slug === formData.advancedTrackSlug
  );
  const selectedAdvancedTopics = selectedAdvancedTrack?.topics ?? [];
  const hasSelectedCategory =
    resourceTier === "advanced" ? Boolean(formData.advancedTrackSlug) : Boolean(formData.category);
  const submitBlockedByRole = resourceTier === "advanced" && !canAccessAdvancedUpload;
  const fileAccept =
    resourceTier === "advanced"
      ? ".pdf,.doc,.docx,.mp4,.webm"
      : ".png,.jpg,.jpeg,.webp,.pdf";
  const fileHint =
    resourceTier === "advanced"
      ? "Supports PDF, DOC, DOCX, MP4, WEBM • Max 25 MB"
      : "Supports PNG, JPG, WEBP, PDF • Max 10 MB";
  const allChecked = checks.ownership && checks.license && checks.tos;
  const hasSelectedContent = uploadMode === "file" ? Boolean(file) : Boolean(formData.resourceUrl);
  const canSubmit =
    allChecked &&
    !!session?.user &&
    !uploading &&
    !submitBlockedByRole &&
    hasSelectedCategory &&
    hasSelectedContent;

  useEffect(() => {
    if (!sessionName) return;

    setFormData((current) => (
      current.authorCredit ? current : { ...current, authorCredit: sessionName }
    ));
  }, [sessionName]);

  useEffect(() => {
    let cancelled = false;

    const loadAdvancedTracks = async () => {
      setAdvancedCatalogLoading(true);
      setAdvancedCatalogError("");

      try {
        const res = await fetch("/api/advanced-tracks", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load advanced tracks");
        }

        const payload = (await res.json()) as { tracks?: AdvancedTrack[] };
        if (cancelled) return;

        setAdvancedTracks(payload.tracks || []);
      } catch {
        if (!cancelled) {
          setAdvancedTracks([]);
          setAdvancedCatalogError("Could not load advanced tracks right now.");
        }
      } finally {
        if (!cancelled) {
          setAdvancedCatalogLoading(false);
        }
      }
    };

    void loadAdvancedTracks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      resourceTier !== "advanced" ||
      formData.advancedTrackSlug ||
      advancedTracks.length === 0
    ) {
      return;
    }

    setFormData((current) => ({
      ...current,
      advancedTrackSlug: advancedTracks[0].slug,
    }));
  }, [resourceTier, formData.advancedTrackSlug, advancedTracks]);

  useEffect(() => () => {
    if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl);
  }, [fileObjectUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "advancedTrackSlug") {
      setFormData((current) => ({
        ...current,
        advancedTrackSlug: value,
        advancedTopicSlug: "",
      }));
      return;
    }

    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) applyFile(e.dataTransfer.files[0]);
  };

  const applyFile = useCallback((f: File) => {
    setFile(f);
    setFileObjectUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return f.type.startsWith("image/") ? URL.createObjectURL(f) : "";
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) applyFile(e.target.files[0]);
  };

  const removeFile = useCallback(() => {
    setFile(null);
    setFileObjectUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return "";
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) { router.push("/login"); return; }
    setUploading(true); setUploadResult(null);

    try {
      if (resourceTier === "advanced") {
        if (!canAccessAdvancedUpload) {
          setUploadResult({
            success: false,
            message: "Advanced DB upload is available only for admin or moderator accounts.",
          });
          return;
        }

        if (!formData.advancedTrackSlug) {
          setUploadResult({
            success: false,
            message: "Select an advanced track before submitting.",
          });
          return;
        }

        if (uploadMode === "file" && !file) {
          setUploadResult({
            success: false,
            message: "Choose a file to upload for Advanced Tracks DB.",
          });
          return;
        }

        if (uploadMode === "link" && !formData.resourceUrl) {
          setUploadResult({
            success: false,
            message: "Provide a resource URL for Advanced Tracks DB link submission.",
          });
          return;
        }

        const advancedBody = new FormData();
        if (uploadMode === "file" && file) {
          advancedBody.append("file", file);
        }
        advancedBody.append("title", formData.title);
        advancedBody.append("summary", formData.description);
        advancedBody.append("trackSlug", formData.advancedTrackSlug);
        advancedBody.append("topicSlug", formData.advancedTopicSlug || "");
        advancedBody.append("resourceType", formData.advancedResourceType);
        advancedBody.append("tags", formData.tags);
        advancedBody.append("status", "pending");
        advancedBody.append("premiumOnly", "true");
        advancedBody.append("featured", "false");

        if (uploadMode === "link") {
          advancedBody.append("contentUrl", formData.resourceUrl);
        }

        const res = await fetch("/api/admin/advanced-tracks", {
          method: "POST",
          body: advancedBody,
        });

        const data = await res.json();
        setUploadResult({
          success: res.ok,
          message:
            data.message ||
            data.error ||
            (res.ok
              ? "Advanced resource saved to Advanced DB and queued for review."
              : "Advanced upload failed"),
          noteId: data.resourceId,
        });
        return;
      }

      const body = new FormData();
      if (uploadMode === "file" && file) body.append("file", file);
      body.append("title", formData.title);
      body.append("description", formData.description);
      body.append("category", formData.category);
      body.append("tags", formData.tags);
      body.append("authorCredit", formData.authorCredit || sessionName);
      body.append("sourceUrl", formData.resourceUrl || formData.sourceUrl);
      body.append("resourceUrl", formData.resourceUrl);
      body.append("licenseType", formData.licenseType);
      body.append("uploadMode", uploadMode);

      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      setUploadResult({ success: res.ok, message: data.message || data.error || "Upload failed", noteId: data.noteId });
    } catch {
      setUploadResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setUploadResult(null); removeFile();
    setResourceTier("standard");
    setUploadMode("file");
    setFormData({ ...INITIAL_FORM_DATA, authorCredit: sessionName });
    setChecks({ ownership: false, license: false, tos: false });
    setPreviewOpen(false);
  };

  const linkMeta = detectLinkType(formData.resourceUrl);

  // ── Success screen ────────────────────────
  if (uploadResult?.success) {
    return (
      <div className={styles.page}>
        <div className={styles.formContainer}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>🎉</div>
            <h2 className={styles.successTitle}>Submitted!</h2>
            <p className={styles.successText}>{uploadResult.message}</p>
            <div className={styles.successActions}>
              <button className="btn btn-primary btn-lg" onClick={resetForm}>Share Another</button>
              <Link href="/browse" className="btn btn-secondary btn-lg">Browse Notes</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Live Preview Drawer */}
      <PreviewDrawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        resourceTier={resourceTier}
        advancedTracks={advancedTracks}
        mode={uploadMode}
        fileObjectUrl={fileObjectUrl}
        formData={formData}
        session={session}
      />

      {/* Floating Preview Button */}
      <button
        className={`${styles.floatingPreviewBtn} ${previewOpen ? styles.floatingPreviewBtnActive : ""}`}
        onClick={() => setPreviewOpen(!previewOpen)}
        id="floating-preview-btn"
        title="Preview your note"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>{previewOpen ? "Close Preview" : "Preview"}</span>
      </button>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerBg} />
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Share a Resource</h1>
          <p className={styles.subtitle}>
            Upload your notes or share any community link — Google Drive, GitHub, YouTube, and more.
          </p>
          {!session?.user && (
            <div className={styles.authNotice}>
              <Link href="/login" className="btn btn-primary btn-sm">Sign in to share</Link>
            </div>
          )}
        </div>
      </div>

      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {uploadResult && !uploadResult.success && (
            <div className={styles.errorBanner}>{uploadResult.message}</div>
          )}

          {/* ── Mode Toggle ─────────────────── */}
          <div className={styles.modeToggle}>
            <button type="button" id="mode-file-btn"
              className={`${styles.modeBtn} ${uploadMode === "file" ? styles.modeBtnActive : ""}`}
              onClick={() => setUploadMode("file")}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload a File
            </button>
            <button type="button" id="mode-link-btn"
              className={`${styles.modeBtn} ${uploadMode === "link" ? styles.modeBtnActive : ""}`}
              onClick={() => setUploadMode("link")}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              Share a Link
            </button>
          </div>

          {/* ── File / Link area ────────────── */}
          <div className={styles.section}>
            {uploadMode === "file" ? (
              <div key="mode-file">
                <h2 className={styles.sectionTitle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload File
                </h2>

                <div
                  className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""} ${file ? styles.dropZoneHasFile : ""}`}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  id="upload-drop-zone"
                >
                  {file ? (
                    <div className={styles.filePreview}>
                      {/* Image thumbnail inside drop zone */}
                      {fileObjectUrl && (
                        <div className={styles.fileThumbWrap}>
                          <Image
                            src={fileObjectUrl}
                            alt="Preview"
                            fill
                            unoptimized
                            sizes="64px"
                            className={styles.fileThumbPreview}
                          />
                        </div>
                      )}
                      {!fileObjectUrl && <div className={styles.fileIcon}>📄</div>}
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{file.name}</span>
                        <span className={styles.fileSize}>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                      </div>
                      <button type="button" className={styles.fileRemove} onClick={removeFile}>Remove</button>
                    </div>
                  ) : (
                    <>
                      <div className={styles.dropIcon}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                      </div>
                      <p className={styles.dropText}>
                        Drag & drop your file here, or{" "}
                        <label htmlFor="file-input" className={styles.browseLink}>browse</label>
                      </p>
                      <p className={styles.dropHint}>{fileHint}</p>
                    </>
                  )}
                  <input type="file" id="file-input" ref={fileInputRef} className={styles.fileInput}
                    accept={fileAccept} onChange={handleFileSelect} />
                </div>

                {/* Inline image micro-preview strip */}
                {fileObjectUrl && (
                  <button
                    type="button"
                    className={styles.inlinePreviewStrip}
                    onClick={() => setPreviewOpen(true)}
                    id="inline-preview-strip-btn"
                  >
                    <div className={styles.inlinePreviewThumbWrap}>
                      <Image
                        src={fileObjectUrl}
                        alt="thumb"
                        fill
                        unoptimized
                        sizes="52px"
                        className={styles.inlinePreviewThumb}
                      />
                    </div>
                    <span className={styles.inlinePreviewText}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Click to see full preview →
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div key="mode-link">
                <h2 className={styles.sectionTitle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Community Link
                </h2>

                <div className={styles.linkInputWrap}>
                  <span className={styles.linkIcon}>{linkMeta.icon}</span>
                  <input type="url" name="resourceUrl" id="resourceUrl" className={styles.linkInput}
                    placeholder="Paste any link — Google Drive, GitHub, YouTube, Notion…"
                    value={formData.resourceUrl ?? ""} onChange={handleInputChange} autoFocus />
                </div>

                {formData.resourceUrl && (
                  <div className={styles.linkPreview}>
                    <span className={styles.linkPreviewIcon}>{linkMeta.icon}</span>
                    <div className={styles.linkPreviewInfo}>
                      <span className={styles.linkPreviewLabel}>{linkMeta.label}</span>
                      <a href={formData.resourceUrl} target="_blank" rel="noopener noreferrer" className={styles.linkPreviewUrl}>
                        {formData.resourceUrl}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                  </div>
                )}

                <div className={styles.linkExamples}>
                  <span className={styles.linkExamplesLabel}>Accepted sources:</span>
                  {["📁 Google Drive", "🐙 GitHub", "▶️ YouTube", "📝 Notion", "📦 Dropbox", "✍️ Dev.to / Medium"].map(ex => (
                    <span key={ex} className={styles.linkExampleChip}>{ex}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Details ─────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Details
            </h2>

            <div className={styles.detailsToggleBlock}>
              <p className={styles.detailsToggleLabel}>Submission Flow</p>
              <div className={styles.detailsToggle}>
                <button
                  type="button"
                  className={`${styles.detailsToggleBtn} ${resourceTier === "standard" ? styles.detailsToggleBtnActive : ""}`}
                  onClick={() => setResourceTier("standard")}
                >
                  Programming Resource
                </button>
                <button
                  type="button"
                  className={`${styles.detailsToggleBtn} ${resourceTier === "advanced" ? styles.detailsToggleBtnActive : ""}`}
                  onClick={() => setResourceTier("advanced")}
                >
                  Advanced Tracks DB
                </button>
              </div>
              <p className={styles.detailsToggleHint}>
                {resourceTier === "advanced"
                  ? "Advanced mode stores links in Advanced DB track resources."
                  : "Standard mode publishes under regular programming categories."}
              </p>
              {resourceTier === "advanced" && !canAccessAdvancedUpload && (
                <p className={styles.detailsWarning}>
                  You can preview advanced tracks, but submission requires admin or moderator role.
                </p>
              )}
            </div>

            <div className={styles.fieldGrid}>
              <div className={`input-group ${styles.fullWidth}`}>
                <label htmlFor="title" className="input-label">Title <span className={styles.required}>*</span></label>
                <input type="text" id="title" name="title" className="input"
                  placeholder="e.g., SQL Joins Explained — Visual Guide"
                  value={formData.title ?? ""} onChange={handleInputChange} required />
              </div>
              <div className={`input-group ${styles.fullWidth}`}>
                <label htmlFor="description" className="input-label">Description <span className={styles.required}>*</span></label>
                <textarea id="description" name="description" className="input textarea"
                  placeholder="Describe what this resource covers, key topics, and who it's best suited for…"
                  value={formData.description ?? ""} onChange={handleInputChange} required />
              </div>

              {resourceTier === "standard" ? (
                <div className="input-group">
                  <label htmlFor="category" className="input-label">Programming Category <span className={styles.required}>*</span></label>
                  <select id="category" name="category" className="input" value={formData.category ?? ""} onChange={handleInputChange} required>
                    <option value="">Select a category</option>
                    {STANDARD_CATEGORY_CATALOG.map(cat => (
                      <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="input-group">
                    <label htmlFor="advancedTrackSlug" className="input-label">Advanced Track <span className={styles.required}>*</span></label>
                    <select
                      id="advancedTrackSlug"
                      name="advancedTrackSlug"
                      className="input"
                      value={formData.advancedTrackSlug ?? ""}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">
                        {advancedCatalogLoading ? "Loading tracks..." : "Select an advanced track"}
                      </option>
                      {advancedTracks.map((track) => (
                        <option key={track.slug} value={track.slug}>{track.name}</option>
                      ))}
                    </select>
                    {advancedCatalogError && (
                      <span className={styles.fieldError}>{advancedCatalogError}</span>
                    )}
                  </div>

                  <div className="input-group">
                    <label htmlFor="advancedTopicSlug" className="input-label">Track Topic <span className={styles.optional}>(optional)</span></label>
                    <select
                      id="advancedTopicSlug"
                      name="advancedTopicSlug"
                      className="input"
                      value={formData.advancedTopicSlug ?? ""}
                      onChange={handleInputChange}
                      disabled={!selectedAdvancedTrack || selectedAdvancedTopics.length === 0}
                    >
                      <option value="">
                        {selectedAdvancedTrack
                          ? selectedAdvancedTopics.length > 0
                            ? "Select a topic"
                            : "No topics available"
                          : "Choose a track first"}
                      </option>
                      {selectedAdvancedTopics.map((topic) => (
                        <option key={topic.slug} value={topic.slug}>{topic.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="advancedResourceType" className="input-label">Resource Type</label>
                    <select
                      id="advancedResourceType"
                      name="advancedResourceType"
                      className="input"
                      value={formData.advancedResourceType ?? "link"}
                      onChange={handleInputChange}
                    >
                      <option value="link">Link</option>
                      <option value="pdf">PDF</option>
                      <option value="doc">Document</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                </>
              )}

              <div className="input-group">
                <label htmlFor="tags" className="input-label">Tags</label>
                <input type="text" id="tags" name="tags" className="input"
                  placeholder="e.g., joins, subqueries, optimization"
                  value={formData.tags ?? ""} onChange={handleInputChange} />
                <span className={styles.fieldHint}>Separate tags with commas</span>
              </div>
            </div>
          </div>

          {/* ── Author ──────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Author &amp; Attribution
            </h2>
            <div className={styles.fieldGrid}>
              <div className="input-group">
                <label htmlFor="authorCredit" className="input-label">Your Name / Handle <span className={styles.required}>*</span></label>
                <input type="text" id="authorCredit" name="authorCredit" className="input"
                  placeholder={sessionName || "Your name or pen name"}
                  value={formData.authorCredit ?? ""} onChange={handleInputChange} required />
              </div>
              {uploadMode === "file" && (
                <div className="input-group">
                  <label htmlFor="sourceUrl" className="input-label">Source URL <span className={styles.optional}>(optional)</span></label>
                  <input type="url" id="sourceUrl" name="sourceUrl" className="input"
                    placeholder="https://your-blog.com/original-post"
                    value={formData.sourceUrl ?? ""} onChange={handleInputChange} />
                </div>
              )}
              <div className={`input-group ${styles.fullWidth}`}>
                <label htmlFor="licenseType" className="input-label">License</label>
                <select id="licenseType" name="licenseType" className="input" value={formData.licenseType ?? "CC-BY-4.0"} onChange={handleInputChange}>
                  <option value="CC-BY-4.0">CC BY 4.0 — Others can share with credit</option>
                  <option value="CC-BY-SA-4.0">CC BY-SA 4.0 — Share alike with credit</option>
                  <option value="all-rights-reserved">All Rights Reserved — View only on xreso</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Legal ───────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Legal Acknowledgements
            </h2>
            <div className={styles.legalChecks}>
              {[
                { key: "ownership", text: <>I confirm that I am the <strong>original author</strong> of this content, or I have explicit permission to share it on this platform.</> },
                { key: "license",   text: <>I understand that I <strong>retain all copyright</strong> to my work. By submitting, I grant xreso a non-exclusive, royalty-free license to host and share this content.</> },
                { key: "tos",       text: <>I have read and agree to the <a href="/terms" className={styles.legalLink}>Terms of Service</a> and <a href="/terms" className={styles.legalLink}>Community Guidelines</a>.</> },
              ].map(({ key, text }) => (
                <label key={key} className={styles.checkLabel} id={`check-${key}`}>
                  <input type="checkbox" className={styles.checkbox}
                    checked={Boolean(checks[key as keyof typeof checks])}
                    onChange={e => setChecks({ ...checks, [key]: e.target.checked })} />
                  <span className={styles.checkmark} />
                  <span className={styles.checkText}>{text}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Submit ──────────────────────── */}
          <div className={styles.submitWrap}>
            <div className={styles.submitRow}>
              <button
                type="button"
                className={`btn btn-secondary btn-lg ${styles.previewBtn}`}
                onClick={() => setPreviewOpen(true)}
                id="preview-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Preview
              </button>
              <button type="submit"
                className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                disabled={!canSubmit} id="submit-upload-btn">
                {uploading ? (
                  <><span className={styles.uploadingSpinner} />Submitting…</>
                ) : (
                  <>
                    {uploadMode === "link"
                      ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    }
                    {resourceTier === "advanced"
                      ? "Submit Advanced Resource"
                      : uploadMode === "file"
                        ? "Upload Notes"
                        : "Share Resource"}
                  </>
                )}
              </button>
            </div>
            <p className={styles.submitHint}>
              {resourceTier === "advanced"
                ? submitBlockedByRole
                  ? "Advanced DB submissions are currently restricted to admin and moderator roles."
                  : "This entry will be stored in Advanced Tracks DB and queued for moderation."
                : uploadMode === "file"
                  ? "Your notes will be reviewed before being published."
                  : "Your link will be reviewed and shared with the community."}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
