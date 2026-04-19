"use client";

import { getVideoPlaybackSource, type VideoSourceType } from "@/lib/video-utils";
import styles from "./VideoPlayer.module.css";

interface VideoPlayerProps {
  videoId: string;
  videoType: VideoSourceType;
  title?: string;
}

export default function VideoPlayer({
  videoId,
  videoType,
  title = "Video Player",
}: VideoPlayerProps) {
  const playback = getVideoPlaybackSource(videoType, videoId);

  return (
    <div className={styles.playerContainer}>
      <div className={styles.playerWrapper}>
        {playback.kind === "video" ? (
          <video
            src={playback.src}
            className={styles.iframe}
            title={title}
            controls
            preload="metadata"
            playsInline
          />
        ) : (
          <iframe
            src={playback.src}
            className={styles.iframe}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
