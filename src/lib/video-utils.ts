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
 * Extract Google Drive file ID from URL
 * Supports: drive.google.com/file/d/ID/view, drive.google.com/open?id=ID
 */
export function extractGoogleDriveId(url: string): string | null {
  const input = sanitizeVideoInput(url);
  if (!input) return null;

  // Format: drive.google.com/file/d/FILE_ID/view
  let match = input.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1];

  // Format: drive.google.com/open?id=FILE_ID
  match = input.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1];

  // Format: docs.google.com/presentation/d/FILE_ID
  match = input.match(/docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/i);
  if (match?.[1]) return match[1];

  try {
    const urlObj = new URL(input);

    // drive.google.com/file/d/ID/view
    if (urlObj.hostname.includes("drive.google.com")) {
      const pathMatch = urlObj.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (pathMatch?.[1]) return pathMatch[1];

      // drive.google.com/open?id=ID
      const fileId = urlObj.searchParams.get("id");
      if (fileId && /^[a-zA-Z0-9_-]+$/.test(fileId)) return fileId;
    }

    // docs.google.com/* /d/ID
    if (urlObj.hostname.includes("docs.google.com")) {
      const pathMatch = urlObj.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (pathMatch?.[1]) return pathMatch[1];
    }
  } catch {
    // Invalid URL format
  }

  return null;
}

/**
 * Detect video type from URL (including Google Drive)
 */
export function detectVideoType(
  url: string
): "youtube" | "vimeo" | "drive" | null {
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

  if (/drive\.google\.com|docs\.google\.com/.test(input)) {
    return "drive";
  }

  return null;
}

/**
 * Extract video ID based on video type (including Drive)
 */
export function extractVideoId(
  url: string,
  videoType: "youtube" | "vimeo" | "drive"
): string | null {
  if (videoType === "youtube") {
    return extractYouTubeId(url);
  } else if (videoType === "vimeo") {
    return extractVimeoId(url);
  } else if (videoType === "drive") {
    return extractGoogleDriveId(url);
  }

  return null;
}

/**
 * Generate Google Drive embed URL from file ID
 */
export function getGoogleDriveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
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
  videoType: "youtube" | "vimeo" | "drive",
  title?: string
): string {
  let embedUrl: string;
  
  if (videoType === "youtube") {
    embedUrl = getYouTubeEmbedUrl(videoId);
  } else if (videoType === "vimeo") {
    embedUrl = getVimeoEmbedUrl(videoId);
  } else {
    embedUrl = getGoogleDriveEmbedUrl(videoId);
  }

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
 * Validate video URL (basic check, including Drive videos)
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
