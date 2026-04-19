"use client";

import { getYouTubeEmbedUrl, getVimeoEmbedUrl, getGoogleDriveEmbedUrl } from "@/lib/video-utils";
import styles from "./VideoPlayer.module.css";

interface VideoPlayerProps {
  videoId: string;
  videoType: "youtube" | "vimeo" | "drive";
  title?: string;
}

export default function VideoPlayer({
  videoId,
  videoType,
  title = "Video Player",
}: VideoPlayerProps) {
  let embedUrl: string;
  
  if (videoType === "youtube") {
    embedUrl = getYouTubeEmbedUrl(videoId);
  } else if (videoType === "vimeo") {
    embedUrl = getVimeoEmbedUrl(videoId);
  } else {
    embedUrl = getGoogleDriveEmbedUrl(videoId);
  }

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
