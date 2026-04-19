import Image from "next/image";
import { useMemo, useState } from "react";
import styles from "./VideoCard.module.css";

interface VideoCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug?: string;
  author: string;
  authorId?: string;
  thumbnailUrl: string;
  videoType: string;
  viewCount: number;
  createdAt: string;
  onOpen?: () => void;
}

function getVideoIcon(videoType: string): string {
  if (videoType === "youtube") return "▶️";
  if (videoType === "vimeo") return "🎬";
  if (videoType === "onedrive") return "☁️";
  return "🎥";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getInitials(title: string): string {
  const parts = (title || "")
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return "VD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getDescriptionBadge(description: string): string | null {
  const match = description.match(/https:\/\/\S+/i);
  if (!match) return null;

  try {
    const url = new URL(match[0]);
    const host = url.hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "📎 YouTube";
    if (host.includes("drive.google.com") || host.includes("docs.google.com")) return "📎 Google Drive";
    return "📎 External Link";
  } catch {
    return "📎 External Link";
  }
}

function getDisplayAuthor(author: string): string {
  const normalized = (author || "").trim();
  if (!normalized || normalized.toLowerCase() === "anonymous") {
    return "Community Member";
  }
  return normalized;
}

export default function VideoCard({
  id,
  title,
  description,
  category,
  categorySlug,
  author,
  authorId,
  thumbnailUrl,
  videoType,
  viewCount,
  createdAt,
  onOpen,
}: VideoCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = useMemo(() => getInitials(title), [title]);
  const descriptionBadge = useMemo(() => getDescriptionBadge(description), [description]);

  void category;
  void categorySlug;
  void authorId;

  return (
    <article className={styles.videoCard} id={`video-card-${id}`}>
      <button
        type="button"
        className={styles.cardButton}
        aria-label={`Watch ${title}`}
        onClick={onOpen}
      />

      <div className={styles.videoThumb}>
        {thumbnailUrl && !imageFailed ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, (max-width: 1700px) 33vw, 25vw"
            className={styles.thumbImage}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.thumbPlaceholder} aria-hidden="true">
            <span className={styles.thumbInitials}>{initials}</span>
          </div>
        )}

        <div className={styles.playButton}>
          <div className={styles.playIcon}>{getVideoIcon(videoType)}</div>
        </div>
      </div>

      <div className={styles.videoContent}>
        <h3 className={styles.videoTitle}>{title}</h3>
        {descriptionBadge ? (
          <span className={styles.videoDescBadge}>{descriptionBadge}</span>
        ) : (
          <p className={styles.videoDesc}>{description}</p>
        )}

        <div className={styles.videoFooter}>
          <div className={styles.videoMeta}>
            <span className={styles.author}>{getDisplayAuthor(author)}</span>
            <span className={styles.separator}>•</span>
            <span className={styles.date}>{formatDate(createdAt)}</span>
          </div>
          <span className={styles.views}>
            👁️ {viewCount.toLocaleString()} {viewCount === 1 ? "view" : "views"}
          </span>
        </div>
      </div>
    </article>
  );
}
