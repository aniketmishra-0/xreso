import Image from "next/image";
import Link from "next/link";
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
}: VideoCardProps) {
  return (
    <article className={styles.videoCard} id={`video-card-${id}`}>
      <Link
        href={`/videos/${id}`}
        className={styles.cardLink}
        aria-label={`Watch ${title}`}
      />

      {/* Video Thumbnail */}
      <div className={styles.videoThumb}>
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, (max-width: 1700px) 33vw, 25vw"
            className={styles.thumbImage}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = "none";
            }}
          />
        ) : null}
        
        {/* Play Button Overlay */}
        <div className={styles.playButton}>
          <div className={styles.playIcon}>{getVideoIcon(videoType)}</div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.videoContent}>
        <h3 className={styles.videoTitle}>{title}</h3>
        <p className={styles.videoDesc}>{description}</p>

        {/* Footer */}
        <div className={styles.videoFooter}>
          <div className={styles.videoMeta}>
            <span className={styles.author}>{author}</span>
            <span className={styles.separator}>•</span>
            <span className={styles.date}>{formatDate(createdAt)}</span>
          </div>
          <span className={styles.views}>
            👁️ {viewCount.toLocaleString()} views
          </span>
        </div>
      </div>
    </article>
  );
}
