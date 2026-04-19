import {
  detectVideoType,
  extractVideoId,
  getGoogleDriveEmbedUrl,
  getOneDriveEmbedUrl,
  getVimeoEmbedUrl,
  getYouTubeEmbedUrl,
  type VideoSourceType,
} from "@/lib/video-utils";

const REQUEST_TIMEOUT_MS = 5000;
const PRIVATE_PATTERNS = [
  /you need access/i,
  /request access/i,
  /sign in/i,
  /permission/i,
  /not found/i,
  /private/i,
  /video unavailable/i,
  /unable to open the file/i,
];

function buildEmbedUrl(videoType: VideoSourceType, videoId: string): string {
  if (videoType === "youtube") return getYouTubeEmbedUrl(videoId);
  if (videoType === "vimeo") return getVimeoEmbedUrl(videoId);
  if (videoType === "drive") return getGoogleDriveEmbedUrl(videoId);
  return getOneDriveEmbedUrl(videoId);
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseSnippet(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 2000);
  } catch {
    return "";
  }
}

export interface VideoAccessCheckResult {
  isPublic: boolean;
  videoType: VideoSourceType | null;
  videoId: string | null;
  embedUrl: string;
  message: string;
}

export async function inspectVideoAccess(url: string): Promise<VideoAccessCheckResult> {
  const detectedType = detectVideoType(url);
  if (!detectedType) {
    return {
      isPublic: false,
      videoType: null,
      videoId: null,
      embedUrl: "",
      message: "Unsupported video source.",
    };
  }

  const videoId = extractVideoId(url, detectedType);
  if (!videoId) {
    return {
      isPublic: false,
      videoType: detectedType,
      videoId: null,
      embedUrl: "",
      message: "Could not read the video link.",
    };
  }

  const embedUrl = buildEmbedUrl(detectedType, videoId);

  if (detectedType === "youtube") {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    try {
      const response = await fetchWithTimeout(oembedUrl, {
        headers: { "User-Agent": "xreso-video-check/1.0" },
      });
      if (response.ok) {
        return {
          isPublic: true,
          videoType: detectedType,
          videoId,
          embedUrl,
          message: "Video is public and embeddable.",
        };
      }

      return {
        isPublic: false,
        videoType: detectedType,
        videoId,
        embedUrl,
        message: "YouTube video is not public or embeddable.",
      };
    } catch {
      return {
        isPublic: false,
        videoType: detectedType,
        videoId,
        embedUrl,
        message: "Could not verify YouTube video visibility.",
      };
    }
  }

  if (detectedType === "vimeo") {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
    try {
      const response = await fetchWithTimeout(oembedUrl, {
        headers: { "User-Agent": "xreso-video-check/1.0" },
      });
      if (response.ok) {
        return {
          isPublic: true,
          videoType: detectedType,
          videoId,
          embedUrl,
          message: "Video is public and embeddable.",
        };
      }

      return {
        isPublic: false,
        videoType: detectedType,
        videoId,
        embedUrl,
        message: "Vimeo video is not public or embeddable.",
      };
    } catch {
      return {
        isPublic: false,
        videoType: detectedType,
        videoId,
        embedUrl,
        message: "Could not verify Vimeo video visibility.",
      };
    }
  }

  if (detectedType === "drive") {
    try {
      const response = await fetchWithTimeout(embedUrl, {
        headers: { "User-Agent": "xreso-video-check/1.0" },
      });
      const snippet = (await readResponseSnippet(response)).toLowerCase();
      const blocked = PRIVATE_PATTERNS.some((pattern) => pattern.test(snippet));

      if (response.ok && !blocked) {
        return {
          isPublic: true,
          videoType: detectedType,
          videoId,
          embedUrl,
          message: "Google Drive video is public and embeddable.",
        };
      }

      return {
        isPublic: false,
        videoType: detectedType,
        videoId,
        embedUrl,
        message: "Google Drive file is not public or embeddable.",
      };
    } catch {
      return {
        isPublic: false,
        videoType: detectedType,
        videoId,
        embedUrl,
        message: "Could not verify Google Drive visibility.",
      };
    }
  }

  if (detectedType === "onedrive" && videoId.startsWith("item:")) {
    return {
      isPublic: true,
      videoType: detectedType,
      videoId,
      embedUrl,
      message: "OneDrive video is available to the app and ready to post.",
    };
  }

  try {
    const response = await fetchWithTimeout(embedUrl, {
      headers: { "User-Agent": "xreso-video-check/1.0" },
    });
    const snippet = (await readResponseSnippet(response)).toLowerCase();
    const blocked = PRIVATE_PATTERNS.some((pattern) => pattern.test(snippet));

    if (response.ok && !blocked) {
      return {
        isPublic: true,
        videoType: detectedType,
        videoId,
        embedUrl,
        message: "Video is public and embeddable.",
      };
    }
  } catch {
    // Ignore and fall through.
  }

  return {
    isPublic: false,
    videoType: detectedType,
    videoId,
    embedUrl,
    message: "Video is not public or embeddable.",
  };
}
