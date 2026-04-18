"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || "";
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      const isMobileUA = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      setIsMobile((isTouchDevice && isSmallScreen) || isMobileUA);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

interface NoteDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  author: string;
  authorAvatar: string | null;
  authorCredit: string;
  authorId: string;
  thumbnailUrl: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  sourceUrl: string | null;
  licenseType: string;
  viewCount: number;
  bookmarkCount: number;
  tags: string[];
  createdAt: string;
}

function isSyntheticPlaceholderUrl(url: string): boolean {
  return /\/placeholder-(note|thumb)-\d+\.png/i.test(url);
}

function getEmbeddableLink(link: string): string | null {
  if (!link) return null;

  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // Google Drive file links => preview iframe URL.
    if (host.includes("drive.google.com")) {
      const fileIdMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      const fileId = fileIdMatch?.[1] || url.searchParams.get("id");
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }

      // Folder/share links are often blocked in iframes.
      return null;
    }

    // Already a Google Docs viewer URL.
    if (host.includes("docs.google.com") && pathname.includes("/gview")) {
      return link;
    }

    // External PDF links may send restrictive frame headers; gview is more reliable.
    if (pathname.endsWith(".pdf")) {
      return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(link)}`;
    }

    return null;
  } catch {
    return null;
  }
}

export default function NoteDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  useEffect(() => {
    async function fetchNote() {
      try {
        const res = await fetch(`/api/notes/${params.id}`);
        if (!res.ok) {
          setError("Note not found");
          return;
        }
        const data = await res.json();
        setNote(data.note);
      } catch {
        setError("Failed to load note");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchNote();
  }, [params.id]);

  useEffect(() => {
    if (!note || note.fileType === "application/pdf" || note.fileType === "link") {
      setImageLoadFailed(false);
      return;
    }

    const fileUrl = note.fileUrl || "";

    if (!fileUrl || isSyntheticPlaceholderUrl(fileUrl)) {
      setImageLoadFailed(true);
      return;
    }

    const probeImage = new Image();
    probeImage.onload = () => setImageLoadFailed(false);
    probeImage.onerror = () => setImageLoadFailed(true);
    probeImage.src = fileUrl;

    return () => {
      probeImage.onload = null;
      probeImage.onerror = null;
    };
  }, [note]);

  const handleBookmark = async () => {
    if (!session?.user) {
      window.location.href = "/login";
      return;
    }
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: note?.id }),
      });
      const data = await res.json();
      setBookmarked(data.bookmarked);
      if (note) {
        setNote({
          ...note,
          bookmarkCount: note.bookmarkCount + (data.bookmarked ? 1 : -1),
        });
      }
    } catch {
      console.error("Bookmark failed");
    }
  };

  const handleReport = async () => {
    if (!session?.user) {
      window.location.href = "/login";
      return;
    }
    const reason = window.prompt("Why are you reporting this note? (Spam, Inappropriate, Broken link)");
    if (!reason) return;
    try {
      const res = await fetch(`/api/notes/${params.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error || "Failed to submit report");
      } else {
        window.alert(data.message || "Thank you for your report. An admin will review it.");
      }
    } catch {
      window.alert("Failed to submit report. Please try again.");
    }
  };

  const handleZoom = () => {
    setZoom((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const handleFullscreen = () => {
    if (!viewerRef.current) return;
    const el = viewerRef.current as HTMLElement & { webkitRequestFullscreen?: () => void };
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else {
        document.exitFullscreen();
      }
    } else {
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen();
      }
    }
  };

  // Pinch-to-zoom for mobile image viewer
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchRef.current = { startDist: dist, startZoom: zoom };
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchRef.current.startDist;
      const newZoom = Math.min(Math.max(touchRef.current.startZoom * scale, 1), 3);
      setZoom(newZoom);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <p>Loading note...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>😔</div>
            <h2>Note Not Found</h2>
            <p>{error || "This note may have been removed or doesn't exist."}</p>
            <Link href="/browse" className="btn btn-primary">
              Browse Notes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fileSizeMB = (note.fileSizeBytes / (1024 * 1024)).toFixed(1);
  const formattedDate = new Date(note.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const embeddableLink = note.fileType === "link" ? getEmbeddableLink(note.fileUrl) : null;
  const ogFallbackUrl = `/api/og?title=${encodeURIComponent(note.title)}&category=${encodeURIComponent(note.category)}&v=4`;
  const hasUsableThumbnail = !!note.thumbnailUrl && !isSyntheticPlaceholderUrl(note.thumbnailUrl);
  const imageSourceUrl =
    !imageLoadFailed && note.fileUrl && !isSyntheticPlaceholderUrl(note.fileUrl)
      ? note.fileUrl
      : hasUsableThumbnail
        ? note.thumbnailUrl
        : ogFallbackUrl;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>Home</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link href="/browse" className={styles.breadcrumbLink}>Browse</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link href={`/browse?category=${note.categorySlug}`} className={styles.breadcrumbLink}>
            {note.category}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{note.title}</span>
        </nav>

        <div className={styles.layout}>
          {/* Main Content */}
          <div className={styles.main}>
            {/* File Viewer */}
            <div className={styles.viewer} ref={viewerRef}>
              {note.fileType === "application/pdf" ? (
                <iframe
                  src={isMobile ? `/pdfviewer.html?file=${encodeURIComponent(note.fileUrl)}` : note.fileUrl}
                  className={styles.viewerPdf}
                  title={note.title}
                  sandbox={isMobile ? "allow-scripts allow-same-origin" : undefined}
                />
              ) : note.fileType === "link" && embeddableLink ? (
                <iframe
                  src={embeddableLink}
                  className={styles.viewerPdf}
                  title={note.title}
                  allow="autoplay"
                />
              ) : note.fileType === "link" ? (
                <div className={styles.viewerLink}>
                  <div className={styles.linkIcon}>🔗</div>
                  <h3>External Resource</h3>
                  <a href={note.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    Open Link ↗
                  </a>
                </div>
              ) : (
                <div
                  className={styles.viewerImage}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    backgroundImage: `url(${imageSourceUrl})`,
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: touchRef.current ? "none" : "transform 0.3s ease",
                  }}
                />
              )}
              <div className={styles.viewerControls}>
                {note.fileType !== "application/pdf" && note.fileType !== "link" && (
                  <button className="btn btn-secondary btn-sm" id="zoom-btn" onClick={handleZoom}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      {zoom === 1 ? (
                        <>
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <line x1="11" y1="8" x2="11" y2="14" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        </>
                      ) : (
                        <>
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        </>
                      )}
                    </svg>
                    <span className={styles.controlLabel}>
                      {zoom === 1 ? "Zoom In" : "Zoom Out"}
                    </span>
                  </button>
                )}
                {note.fileType !== "link" ? (
                  <a
                    href={`${note.fileUrl}?action=download`}
                    download={note.fileName}
                    className="btn btn-secondary btn-sm"
                    id="download-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span className={styles.controlLabel}>Download</span>
                  </a>
                ) : (
                  <a
                    href={note.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    id="open-link-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    <span className={styles.controlLabel}>Open Link</span>
                  </a>
                )}
                <button className="btn btn-secondary btn-sm" id="fullscreen-btn" onClick={handleFullscreen}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  <span className={styles.controlLabel}>Fullscreen</span>
                </button>
                {isMobile && note.fileType === "application/pdf" && (
                  <a
                    href={note.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    id="open-browser-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    <span className={styles.controlLabel}>Open</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            {/* Title & Meta */}
            <div className={styles.sideSection}>
              <span className="badge badge-green">{note.category}</span>
              <h1 className={styles.noteTitle}>{note.title}</h1>
              <p className={styles.noteDescription}>{note.description}</p>
            </div>

            {/* Author */}
            <div className={styles.sideSection}>
              <h3 className={styles.sideSectionTitle}>Author</h3>
              <Link href={`/user/${note.authorId}`} className={styles.authorCard}>
                <div className={styles.authorAvatar}>
                  {note.authorCredit?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className={styles.authorInfo}>
                  <span className={styles.authorName}>{note.authorCredit}</span>
                  <span className={styles.authorDate}>Published {formattedDate}</span>
                </div>
              </Link>
              {note.sourceUrl && (
                <a
                  href={note.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.resourceCard}
                  id="open-resource-btn"
                >
                  <span className={styles.resourceIcon}>
                    {note.sourceUrl.includes("drive.google.com") || note.sourceUrl.includes("docs.google.com") ? "📁" :
                     note.sourceUrl.includes("github.com") ? "🐙" :
                     note.sourceUrl.includes("youtube.com") || note.sourceUrl.includes("youtu.be") ? "▶️" :
                     note.sourceUrl.includes("notion.so") ? "📝" :
                     note.sourceUrl.includes("dropbox.com") ? "📦" :
                     note.sourceUrl.includes("figma.com") ? "🎨" :
                     note.sourceUrl.includes("medium.com") || note.sourceUrl.includes("dev.to") ? "✍️" : "🔗"}
                  </span>
                  <div className={styles.resourceInfo}>
                    <span className={styles.resourceLabel}>
                      {note.sourceUrl.includes("drive.google.com") || note.sourceUrl.includes("docs.google.com") ? "Google Drive" :
                       note.sourceUrl.includes("github.com") ? "GitHub Repository" :
                       note.sourceUrl.includes("youtube.com") || note.sourceUrl.includes("youtu.be") ? "YouTube Video" :
                       note.sourceUrl.includes("notion.so") ? "Notion Page" :
                       note.sourceUrl.includes("dropbox.com") ? "Dropbox" :
                       note.sourceUrl.includes("figma.com") ? "Figma File" :
                       "Community Resource"}
                    </span>
                    <span className={styles.resourceOpen}>Open Resource →</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              )}
            </div>

            {/* Stats */}
            <div className={styles.sideSection}>
              <h3 className={styles.sideSectionTitle}>Stats</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{note.viewCount.toLocaleString()}</span>
                  <span className={styles.statLabel}>Views</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{note.bookmarkCount.toLocaleString()}</span>
                  <span className={styles.statLabel}>Bookmarks</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{fileSizeMB} MB</span>
                  <span className={styles.statLabel}>File Size</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{note.fileType.split("/")[1]?.toUpperCase()}</span>
                  <span className={styles.statLabel}>Format</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className={styles.sideSection}>
              <h3 className={styles.sideSectionTitle}>Tags</h3>
              <div className={styles.tagsList}>
                {note.tags.map((tag) => (
                  <Link key={tag} href={`/browse?tag=${tag}`} className={styles.tagChip}>
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* License */}
            <div className={styles.sideSection}>
              <h3 className={styles.sideSectionTitle}>License</h3>
              <div className={styles.licenseCard}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
                </svg>
                <span>{note.licenseType}</span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.sideSection}>
              <button
                className={`btn ${bookmarked ? "btn-secondary" : "btn-primary"}`}
                style={{ width: "100%" }}
                onClick={handleBookmark}
                id="bookmark-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                {bookmarked ? "Bookmarked" : "Bookmark This Note"}
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: "100%", marginTop: "8px" }}
                onClick={handleReport}
                id="report-btn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                Report This Note
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
