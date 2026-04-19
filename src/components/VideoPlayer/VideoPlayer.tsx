"use client";

import { getYouTubeEmbedUrl, getVimeoEmbedUrl } from "@/lib/video-utils";
import styles from "./VideoPlayer.module.css";

interface VideoPlayerProps {
  videoId: string;
  videoType: "youtube" | "vimeo";
  title?: string;
}

export default function VideoPlayer({
  videoId,
  videoType,
  title = "Video Player",
}: VideoPlayerProps) {
  const embedUrl =
    videoType === "youtube"
      ? getYouTubeEmbedUrl(videoId)
      : getVimeoEmbedUrl(videoId);

  return (
    <div className={styles.playerContainer}>
      <div className={styles.playerWrapper}>
        <iframe
          src={embedUrl}
          className={styles.iframe}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
