"use client";

import { useState } from "react";
import VideoPlayer from "@/components/VideoPlayer/VideoPlayer";
import {
  isValidVideoUrl,
  detectVideoType,
  extractVideoId,
  getYouTubeThumbnailUrl,
} from "@/lib/video-utils";
import styles from "./VideoUploadForm.module.css";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface VideoUploadFormProps {
  categories: Category[];
  onSuccess?: (videoId: string) => void;
}

export default function VideoUploadForm({
  categories,
  onSuccess,
}: VideoUploadFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    videoUrl: "",
    licenseType: "CC-BY-4.0",
  });

  const [videoPreview, setVideoPreview] = useState<{
    videoId: string;
    videoType: "youtube" | "vimeo";
    thumbnailUrl: string;
  } | null>(null);

  const [checks, setChecks] = useState({
    ownership: false,
    license: false,
    tos: false,
  });

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleVideoUrlChange = (url: string) => {
    setFormData((prev) => ({ ...prev, videoUrl: url }));
    setError("");

    if (!url.trim()) {
      setVideoPreview(null);
      return;
    }

    if (!isValidVideoUrl(url)) {
      setError(
        "Invalid video URL. Supported: YouTube (youtube.com, youtu.be) and Vimeo (vimeo.com)"
      );
      setVideoPreview(null);
      return;
    }

    const videoType = detectVideoType(url);
    if (!videoType) {
      setError("Could not determine video type");
      setVideoPreview(null);
      return;
    }

    const videoId = extractVideoId(url, videoType);
    if (!videoId) {
      setError("Could not extract video ID from URL");
      setVideoPreview(null);
      return;
    }

    const thumbnailUrl =
      videoType === "youtube" ? getYouTubeThumbnailUrl(videoId) : "";

    setVideoPreview({
      videoId,
      videoType,
      thumbnailUrl,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }

    if (!formData.categoryId) {
      setError("Please select a category");
      return;
    }

    if (!formData.videoUrl.trim()) {
      setError("Video URL is required");
      return;
    }

    if (!videoPreview) {
      setError("Invalid video URL");
      return;
    }

    if (!checks.ownership || !checks.license || !checks.tos) {
      setError("Please accept all terms and conditions");
      return;
    }

    setUploading(true);

    try {
      const response = await fetch("/api/videos/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          categoryId: parseInt(formData.categoryId),
          videoUrl: formData.videoUrl,
          licenseType: formData.licenseType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to upload video");
        return;
      }

      setSuccess(true);
      setFormData({
        title: "",
        description: "",
        categoryId: "",
        videoUrl: "",
        licenseType: "CC-BY-4.0",
      });
      setVideoPreview(null);
      setChecks({ ownership: false, license: false, tos: false });

      if (onSuccess) {
        onSuccess(data.videoId);
      }

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const canSubmit =
    formData.title.trim() &&
    formData.description.trim() &&
    formData.categoryId &&
    videoPreview &&
    checks.ownership &&
    checks.license &&
    checks.tos &&
    !uploading;

  return (
    <div className={styles.uploadForm}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Title */}
        <div className={styles.formGroup}>
          <label htmlFor="title" className={styles.label}>
            Video Title *
          </label>
          <input
            id="title"
            type="text"
            placeholder="Enter video title..."
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            className={styles.input}
            disabled={uploading}
          />
        </div>

        {/* Description */}
        <div className={styles.formGroup}>
          <label htmlFor="description" className={styles.label}>
            Description *
          </label>
          <textarea
            id="description"
            placeholder="Describe your video..."
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            className={styles.textarea}
            rows={4}
            disabled={uploading}
          />
        </div>

        {/* Category */}
        <div className={styles.formGroup}>
          <label htmlFor="category" className={styles.label}>
            Category *
          </label>
          <select
            id="category"
            value={formData.categoryId}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, categoryId: e.target.value }))
            }
            className={styles.select}
            disabled={uploading}
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Video URL */}
        <div className={styles.formGroup}>
          <label htmlFor="videoUrl" className={styles.label}>
            Video URL (YouTube or Vimeo) *
          </label>
          <input
            id="videoUrl"
            type="url"
            placeholder="Paste YouTube or Vimeo link..."
            value={formData.videoUrl}
            onChange={(e) => handleVideoUrlChange(e.target.value)}
            className={styles.input}
            disabled={uploading}
          />
          <p className={styles.hint}>
            Supports YouTube (youtube.com, youtu.be) and Vimeo (vimeo.com)
          </p>
        </div>

        {/* Video Preview */}
        {videoPreview && (
          <div className={styles.previewSection}>
            <h3 className={styles.previewTitle}>Video Preview</h3>
            <VideoPlayer
              videoId={videoPreview.videoId}
              videoType={videoPreview.videoType}
              title={formData.title || "Video Preview"}
            />
          </div>
        )}

        {/* License */}
        <div className={styles.formGroup}>
          <label htmlFor="license" className={styles.label}>
            License Type
          </label>
          <select
            id="license"
            value={formData.licenseType}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, licenseType: e.target.value }))
            }
            className={styles.select}
            disabled={uploading}
          >
            <option value="CC-BY-4.0">Creative Commons Attribution 4.0</option>
            <option value="MIT">MIT License</option>
            <option value="Apache-2.0">Apache License 2.0</option>
            <option value="All-rights-reserved">All Rights Reserved</option>
          </select>
        </div>

        {/* Checkboxes */}
        <div className={styles.checksSection}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={checks.ownership}
              onChange={(e) =>
                setChecks((prev) => ({ ...prev, ownership: e.target.checked }))
              }
              disabled={uploading}
            />
            I own or have permission to use this video
          </label>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={checks.license}
              onChange={(e) =>
                setChecks((prev) => ({ ...prev, license: e.target.checked }))
              }
              disabled={uploading}
            />
            I accept the license terms
          </label>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={checks.tos}
              onChange={(e) =>
                setChecks((prev) => ({ ...prev, tos: e.target.checked }))
              }
              disabled={uploading}
            />
            I agree to the Terms of Service
          </label>
        </div>

        {/* Error */}
        {error && <div className={styles.error}>{error}</div>}

        {/* Success */}
        {success && (
          <div className={styles.success}>
            ✓ Video link published successfully.
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`btn btn-primary btn-lg ${styles.submitBtn}`}
        >
          {uploading ? "Uploading..." : "Submit Video"}
        </button>
      </form>
    </div>
  );
}
