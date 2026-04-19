"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import VideoPlayer from "@/components/VideoPlayer/VideoPlayer";
import styles from "./page.module.css";

interface VideoDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  authorName: string;
  authorCredit: string;
  channelName?: string;
  channelUrl?: string;
  videoType: "youtube" | "vimeo";
  videoId: string;
  viewCount: number;
  licenseType: string;
  createdAt: string;
  updatedAt: string;
}

export default function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [videoId, setVideoId] = useState("");
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setVideoId(p.id));
  }, [params]);

  useEffect(() => {
    if (!videoId) return;

    const fetchVideo = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/videos/${videoId}`);

        if (!response.ok) {
          throw new Error("Video not found");
        }

        const data = await response.json();
        setVideo(data.data);
      } catch (err) {
        setError("Failed to load video");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading video...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          {error || "Video not found"}
          <Link href="/videos" className={styles.backLink}>
            ← Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  const publishDate = new Date(video.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hasCustomChannel = Boolean(video.channelName?.trim() || video.channelUrl?.trim());
  const channelDisplayName = video.channelName?.trim() || "Visit Channel";

  return (
    <div className={styles.container}>
      <Link href="/videos" className={styles.backBtn}>
        ← Back to Videos
      </Link>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 className={styles.title}>{video.title}</h1>
          <p className={styles.heroText}>{video.description}</p>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStatCard}>
            <span className={styles.heroStatLabel}>Published</span>
            <strong className={styles.heroStatValue}>{publishDate}</strong>
          </div>
          <div className={styles.heroStatCard}>
            <span className={styles.heroStatLabel}>Views</span>
            <strong className={styles.heroStatValue}>{video.viewCount.toLocaleString()}</strong>
          </div>
          <div className={styles.heroStatCard}>
            <span className={styles.heroStatLabel}>Platform</span>
            <strong className={styles.heroStatValue}>
              {video.videoType === "youtube" ? "YouTube" : "Vimeo"}
            </strong>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <div className={styles.playerSection}>
          <VideoPlayer
            videoId={video.videoId}
            videoType={video.videoType}
            title={video.title}
          />
        </div>

        <aside className={styles.infoSection}>
          {hasCustomChannel ? (
            <div className={styles.channelCard}>
              <div className={styles.channelInfo}>
                <span className={styles.channelLabel}>Creator Channel</span>
                <strong className={styles.channelName}>{channelDisplayName}</strong>
              </div>
              {video.channelUrl?.trim() ? (
                <a
                  href={video.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.subscribeBtn}
                >
                  Subscribe
                </a>
              ) : null}
            </div>
          ) : null}

          <div className={styles.description}>
            <h2 className={styles.descTitle}>About this video</h2>
            <p className={styles.descText}>{video.description}</p>
          </div>

          <div className={styles.details}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Platform</span>
              <span className={styles.detailValue}>
                {video.videoType === "youtube" ? "YouTube" : "Vimeo"}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>License</span>
              <span className={styles.detailValue}>{video.licenseType}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Published</span>
              <span className={styles.detailValue}>{publishDate}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
