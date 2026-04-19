"use client";

import { useState, useEffect } from "react";
import VideoPlayer from "@/components/VideoPlayer/VideoPlayer";
import {
  detectVideoType,
  extractVideoId,
  type VideoSourceType,
} from "@/lib/video-utils";
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
  videoType: VideoSourceType;
  videoId: string;
  viewCount: number;
  licenseType: string;
  createdAt: string;
  updatedAt: string;
}

interface OneDriveVideoItem {
  id: string;
  name: string;
  streamUrl: string;
  webUrl: string;
  size: number;
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
  const [activeVideoType, setActiveVideoType] = useState<VideoSourceType | null>(null);
  const [activeVideoRef, setActiveVideoRef] = useState("");
  const [manualDriveUrl, setManualDriveUrl] = useState("");
  const [manualDriveError, setManualDriveError] = useState("");
  const [onedriveItems, setOnedriveItems] = useState<OneDriveVideoItem[]>([]);
  const [loadingOnedriveItems, setLoadingOnedriveItems] = useState(false);
  const [onedriveBrowseError, setOnedriveBrowseError] = useState("");

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

  useEffect(() => {
    if (!video) return;
    setActiveVideoType(video.videoType);
    setActiveVideoRef(video.videoId);
  }, [video]);

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

  const handleApplyDriveLink = () => {
    setManualDriveError("");
    const trimmed = manualDriveUrl.trim();
    if (!trimmed) {
      setManualDriveError("Please paste a Google Drive or OneDrive video link.");
      return;
    }

    const type = detectVideoType(trimmed);
    if (!type || (type !== "drive" && type !== "onedrive")) {
      setManualDriveError("Only Google Drive or OneDrive links are allowed here.");
      return;
    }

    const extracted = extractVideoId(trimmed, type);
    if (!extracted) {
      setManualDriveError("Could not parse this link. Try an embeddable/shared link.");
      return;
    }

    setActiveVideoType(type);
    setActiveVideoRef(extracted);
  };

  const handleBrowseOneDrive = async () => {
    setLoadingOnedriveItems(true);
    setOnedriveBrowseError("");

    try {
      const response = await fetch("/api/videos/onedrive-files", { cache: "no-store" });
      const payload = (await response.json()) as {
        items?: OneDriveVideoItem[];
        error?: string;
      };

      if (!response.ok) {
        setOnedriveItems([]);
        setOnedriveBrowseError(payload.error || "Could not browse OneDrive files.");
        return;
      }

      setOnedriveItems(payload.items || []);
      if (!payload.items || payload.items.length === 0) {
        setOnedriveBrowseError("No video files found in your OneDrive Xreso folder.");
      }
    } catch {
      setOnedriveItems([]);
      setOnedriveBrowseError("Failed to browse OneDrive files.");
    } finally {
      setLoadingOnedriveItems(false);
    }
  };

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 className={styles.title}>{video.title}</h1>
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
              {video.videoType === "youtube"
                ? "YouTube"
                : video.videoType === "vimeo"
                  ? "Vimeo"
                  : video.videoType === "drive"
                    ? "Google Drive"
                    : "OneDrive"}
            </strong>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <div className={styles.playerSection}>
          {activeVideoType && activeVideoRef ? (
            <VideoPlayer
              videoId={activeVideoRef}
              videoType={activeVideoType}
              title={video.title}
            />
          ) : null}
        </div>

        <aside className={styles.infoSection}>
          <div className={styles.description}>
            <h2 className={styles.descTitle}>About this video</h2>
            <p className={styles.descText}>{video.description}</p>
          </div>

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

          <div className={styles.driveToolsCard}>
            <h2 className={styles.descTitle}>Drive Playback Tools</h2>
            <p className={styles.descText}>
              Google Drive ya OneDrive link paste karke yahi player me direct run karo.
            </p>

            <div className={styles.driveInputRow}>
              <input
                type="url"
                value={manualDriveUrl}
                onChange={(event) => setManualDriveUrl(event.target.value)}
                placeholder="Paste Drive/OneDrive video link"
                className={styles.driveInput}
              />
              <button type="button" onClick={handleApplyDriveLink} className={styles.driveBtn}>
                Play Link
              </button>
            </div>

            {manualDriveError ? (
              <p className={styles.driveError}>{manualDriveError}</p>
            ) : null}

            <button type="button" onClick={handleBrowseOneDrive} className={styles.driveBrowseBtn}>
              {loadingOnedriveItems ? "Loading OneDrive videos..." : "Browse OneDrive Videos"}
            </button>

            {onedriveBrowseError ? (
              <p className={styles.driveError}>{onedriveBrowseError}</p>
            ) : null}

            {onedriveItems.length > 0 ? (
              <div className={styles.driveList}>
                {onedriveItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.driveListItem}
                    onClick={() => {
                      setActiveVideoType("onedrive");
                      setActiveVideoRef(`item:${item.id}`);
                      setManualDriveError("");
                    }}
                  >
                    <span className={styles.driveListTitle}>{item.name}</span>
                    <span className={styles.driveListMeta}>
                      {item.size > 0
                        ? `${(item.size / (1024 * 1024)).toFixed(1)} MB`
                        : "Video file"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
