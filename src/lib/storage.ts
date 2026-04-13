import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Works with both Cloudflare R2 and AWS S3
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT, // R2: https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const CDN_URL = process.env.S3_CDN_URL || ""; // Public bucket URL or CDN

// ── Generate presigned upload URL ─────────────────────
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  maxSizeBytes = 10 * 1024 * 1024
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: maxSizeBytes,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 600 }); // 10 min
  return url;
}

// ── Generate presigned download URL ───────────────────
export async function getDownloadPresignedUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}

// ── Get public URL for an object ──────────────────────
export function getPublicUrl(key: string) {
  if (CDN_URL) return `${CDN_URL}/${key}`;
  return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
}

// ── Delete an object ──────────────────────────────────
export async function deleteObject(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3.send(command);
}

// ── Upload buffer directly (for thumbnails) ───────────
export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3.send(command);
  return getPublicUrl(key);
}
