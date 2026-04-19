// Video utility functions for extracting IDs, metadata, and validation

function sanitizeVideoInput(url: string): string {
  return (url || "").trim();
}

/**
 * Extract video ID from YouTube URL
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 */
export function extractYouTubeId(url: string): string | null {
  const input = sanitizeVideoInput(url);
  if (!input) return null;

  // Fast regex path to support watch/embed/shorts/live and even malformed host forms.
  const regexes = [
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i,
  ];

  for (const regex of regexes) {
    const match = input.match(regex);
    if (match?.[1]) return match[1];
  }

  try {
    const urlObj = new URL(input);

    // youtube.com/watch?v=ID
    if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtube-nocookie.com")) {
      const videoId = urlObj.searchParams.get("v");
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return videoId;

      const pathMatch = urlObj.pathname.match(/\/(embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
      if (pathMatch?.[2]) return pathMatch[2];
    }

    // youtu.be/ID
    if (urlObj.hostname.includes("youtu.be")) {
      const videoId = urlObj.pathname.split("/").filter(Boolean)[0];
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return videoId;
    }

    // youtube.com/embed/ID
    if (urlObj.pathname.includes("/embed/")) {
      const match = urlObj.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }
  } catch {
    // Invalid URL format
  }

  return null;
}

/**
 * Extract video ID from Vimeo URL
 * Supports: vimeo.com/ID, player.vimeo.com/video/ID
 */
export function extractVimeoId(url: string): string | null {
  const input = sanitizeVideoInput(url);
  if (!input) return null;

  const quickMatch = input.match(/(?:vimeo\.com\/(?:video\/)?)(\d+)/i);
  if (quickMatch?.[1]) return quickMatch[1];

  try {
    const urlObj = new URL(input);

    // vimeo.com/ID
    if (urlObj.hostname.includes("vimeo.com")) {
      const videoId = urlObj.pathname.split("/").pop();
      if (videoId && /^\d+$/.test(videoId)) return videoId;
    }

    // player.vimeo.com/video/ID
    if (urlObj.hostname.includes("player.vimeo.com")) {
      const match = urlObj.pathname.match(/\/video\/(\d+)/);
      if (match) return match[1];
    }
  } catch {
    // Invalid URL format
  }

  return null;
}

/**
 * Detect video type from URL
 */
export function detectVideoType(
  url: string
): "youtube" | "vimeo" | null {
  const input = sanitizeVideoInput(url).toLowerCase();
  if (!input) return null;

  if (
    /youtube\.com|youtube-nocookie\.com|youtu\.be/.test(input)
  ) {
    return "youtube";
  }

  if (/vimeo\.com/.test(input)) {
    return "vimeo";
  }

  return null;
}

/**
 * Extract video ID based on video type
 */
export function extractVideoId(
  url: string,
  videoType: "youtube" | "vimeo"
): string | null {
  if (videoType === "youtube") {
    return extractYouTubeId(url);
  } else if (videoType === "vimeo") {
    return extractVimeoId(url);
  }

  return null;
}

/**
 * Generate YouTube embed URL from video ID
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`;
}

/**
 * Generate YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Generate Vimeo embed URL from video ID
 */
export function getVimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}?h=&title=0&byline=0&portrait=0`;
}

/**
 * Get thumbnail for Vimeo (requires API, fallback to placeholder)
 */
export function getVimeoThumbnailUrl(videoId: string): string {
  // Vimeo doesn't provide direct thumbnail URLs without API access
  // Return a placeholder
  return `/api/og?title=Vimeo Video&category=Video`;
}

/**
 * Get video player iframe HTML (with security restrictions)
 */
export function getVideoIframeHtml(
  videoId: string,
  videoType: "youtube" | "vimeo",
  title?: string
): string {
  const embedUrl =
    videoType === "youtube"
      ? getYouTubeEmbedUrl(videoId)
      : getVimeoEmbedUrl(videoId);

  return `<iframe
    src="${embedUrl}"
    width="100%"
    height="100%"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 8px;"
    title="${title || "Video Player"}"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  ></iframe>`;
}

/**
 * Validate video URL (basic check)
 */
export function isValidVideoUrl(url: string): boolean {
  const videoType = detectVideoType(url);
  if (!videoType) return false;

  const videoId = extractVideoId(url, videoType);
  return Boolean(videoId);
}

/**
 * Format video type for display
 */
export function formatVideoType(videoType: string): string {
  return videoType.charAt(0).toUpperCase() + videoType.slice(1);
}

/**
 * Get video icon for display
 */
export function getVideoIcon(videoType: string): string {
  if (videoType === "youtube") return "▶️";
  if (videoType === "vimeo") return "🎬";
  return "🎥";
}
