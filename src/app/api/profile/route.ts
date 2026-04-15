import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteOneDriveItem,
  isOneDriveConfigured,
  uploadProfilePhotoToOneDrive,
} from "@/lib/onedrive";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = path.join(process.cwd(), "xreso.db");
const USER_PHOTO_API_PREFIX = "/api/profile-photo";
const USER_PHOTO_REL_DIR = "/uploads/user-photos";
const USER_PHOTO_DIR = path.join(process.cwd(), "public", "uploads", "user-photos");
const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

const PHOTO_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function ensureUserPhotoDir() {
  if (!fs.existsSync(USER_PHOTO_DIR)) {
    fs.mkdirSync(USER_PHOTO_DIR, { recursive: true });
  }
}

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function getAvatarLocalPath(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl || !avatarUrl.startsWith(`${USER_PHOTO_REL_DIR}/`)) {
    return null;
  }

  const normalized = path.posix.normalize(avatarUrl);
  if (!normalized.startsWith(`${USER_PHOTO_REL_DIR}/`)) {
    return null;
  }

  return path.join(process.cwd(), "public", normalized.replace(/^\//, ""));
}

function deleteAvatarIfLocal(avatarUrl: string | null | undefined) {
  const localPath = getAvatarLocalPath(avatarUrl);
  if (!localPath) {
    return;
  }

  try {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch (error) {
    console.warn("[Profile Avatar] Could not delete old avatar:", localPath, error);
  }
}

function extractDriveItemIdFromAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl || !avatarUrl.startsWith(`${USER_PHOTO_API_PREFIX}/`)) {
    return null;
  }

  const withoutQuery = avatarUrl.split("?")[0];
  const driveItemId = withoutQuery.slice(`${USER_PHOTO_API_PREFIX}/`.length).trim();
  if (!driveItemId || driveItemId.includes("/")) {
    return null;
  }

  return driveItemId;
}

async function deleteAvatarAsset(avatarUrl: string | null | undefined) {
  const driveItemId = extractDriveItemIdFromAvatarUrl(avatarUrl);
  if (driveItemId) {
    try {
      await deleteOneDriveItem(driveItemId);
      return;
    } catch (error) {
      console.warn("[Profile Avatar] Could not delete OneDrive avatar:", driveItemId, error);
    }
  }

  deleteAvatarIfLocal(avatarUrl);
}

function buildAvatarFileName(userId: string, userName: string, ext: string): string {
  const safeName = sanitizeFilePart(userName) || "user";
  const unique = uuidv4();
  return `${safeName}-${userId}-${unique}.${ext}`;
}

type AvatarSaveResult = {
  avatarUrl: string;
  absolutePath: string | null;
  driveItemId: string | null;
};

async function saveAvatarBuffer(
  buffer: Buffer,
  mimeType: string,
  ext: string,
  userId: string,
  userName: string
): Promise<AvatarSaveResult> {
  const fileName = buildAvatarFileName(userId, userName, ext);

  if (isOneDriveConfigured()) {
    const uploaded = await uploadProfilePhotoToOneDrive(buffer, fileName, mimeType);
    return {
      avatarUrl: `${USER_PHOTO_API_PREFIX}/${uploaded.driveItemId}`,
      absolutePath: null,
      driveItemId: uploaded.driveItemId,
    };
  }

  ensureUserPhotoDir();
  const absolutePath = path.join(USER_PHOTO_DIR, fileName);
  fs.writeFileSync(absolutePath, buffer);

  return {
    avatarUrl: `${USER_PHOTO_REL_DIR}/${fileName}`,
    absolutePath,
    driveItemId: null,
  };
}

async function saveAvatarFromFile(file: File, userId: string, userName: string): Promise<AvatarSaveResult> {
  const mime = file.type.toLowerCase();
  const ext = PHOTO_MIME_EXT[mime];

  if (!ext) {
    throw new Error("Unsupported image type. Use PNG, JPG, WEBP, or GIF.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("Profile image must be under 2MB");
  }

  return saveAvatarBuffer(buffer, mime, ext, userId, userName);
}

async function saveAvatarFromDataUrl(dataUrl: string, userId: string, userName: string): Promise<AvatarSaveResult> {
  const match = dataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
  if (!match) {
    throw new Error("Invalid avatar image");
  }

  const mimeSubtype = match[1].toLowerCase();
  const base64 = match[2];
  const ext = mimeSubtype === "jpeg" || mimeSubtype === "jpg" ? "jpg" : mimeSubtype;

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("Profile image must be under 2MB");
  }

  const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
  return saveAvatarBuffer(buffer, mimeType, ext, userId, userName);
}

function readStringField(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim();
}

/* GET /api/profile — return current user's full profile */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = new Database(DB_PATH);
    const user = db
      .prepare(
        "SELECT id, name, email, avatar, bio, github_url, linkedin_url, twitter_url, website_url, role, premium_access, premium_expires_at, created_at FROM users WHERE id = ?"
      )
      .get(session.user.id) as Record<string, unknown> | undefined;
    db.close();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* PATCH /api/profile — update avatar, bio, and social links */
export async function PATCH(req: NextRequest) {
  let createdAvatarLocalPath: string | null = null;
  let createdAvatarDriveItemId: string | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let name: string | undefined;
    let avatar: string | null | undefined;
    let bio: string | undefined;
    let githubUrl: string | undefined;
    let linkedinUrl: string | undefined;
    let twitterUrl: string | undefined;
    let websiteUrl: string | undefined;
    let removeAvatar = false;
    let avatarFile: File | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = readStringField(formData.get("name"));
      avatar = readStringField(formData.get("avatar"));
      bio = readStringField(formData.get("bio"));
      githubUrl = readStringField(formData.get("githubUrl"));
      linkedinUrl = readStringField(formData.get("linkedinUrl"));
      twitterUrl = readStringField(formData.get("twitterUrl"));
      websiteUrl = readStringField(formData.get("websiteUrl"));

      const removeAvatarField = readStringField(formData.get("removeAvatar"));
      removeAvatar = removeAvatarField === "true" || removeAvatarField === "1";

      const uploaded = formData.get("avatarFile");
      if (uploaded instanceof File && uploaded.size > 0) {
        avatarFile = uploaded;
      }
    } else {
      const body = await req.json();
      name = typeof body.name === "string" ? body.name.trim() : undefined;
      avatar = typeof body.avatar === "string" || body.avatar === null ? body.avatar : undefined;
      bio = typeof body.bio === "string" ? body.bio : undefined;
      githubUrl = typeof body.githubUrl === "string" ? body.githubUrl : undefined;
      linkedinUrl = typeof body.linkedinUrl === "string" ? body.linkedinUrl : undefined;
      twitterUrl = typeof body.twitterUrl === "string" ? body.twitterUrl : undefined;
      websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl : undefined;
      removeAvatar = body.removeAvatar === true;
    }

    // Basic URL validation helper
    const sanitizeUrl = (url: string | undefined) => {
      if (!url || url.trim() === "") return null;
      const u = url.trim();
      if (!u.startsWith("http://") && !u.startsWith("https://")) return `https://${u}`;
      return u;
    };

    const db = new Database(DB_PATH);

    const current = db
      .prepare(
        "SELECT id, name, email, avatar, bio, github_url, linkedin_url, twitter_url, website_url FROM users WHERE id = ?"
      )
      .get(session.user.id) as {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      bio: string | null;
      github_url: string | null;
      linkedin_url: string | null;
      twitter_url: string | null;
      website_url: string | null;
    } | undefined;

    if (!current) {
      db.close();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const nextName = name && name.length > 0 ? name : current.name;
    const nextBio = bio !== undefined ? bio.trim() || null : current.bio;
    const nextGithub = githubUrl !== undefined ? sanitizeUrl(githubUrl) : current.github_url;
    const nextLinkedin = linkedinUrl !== undefined ? sanitizeUrl(linkedinUrl) : current.linkedin_url;
    const nextTwitter = twitterUrl !== undefined ? sanitizeUrl(twitterUrl) : current.twitter_url;
    const nextWebsite = websiteUrl !== undefined ? sanitizeUrl(websiteUrl) : current.website_url;

    let nextAvatar = current.avatar;
    let oldAvatarToDelete: string | null = null;
    let avatarAction: "uploaded" | "updated" | "removed" | null = null;

    if (removeAvatar) {
      if (current.avatar) {
        nextAvatar = null;
        oldAvatarToDelete = current.avatar;
        avatarAction = "removed";
      }
    } else if (avatarFile) {
      if (!avatarFile.type.startsWith("image/")) {
        db.close();
        return NextResponse.json({ error: "Please choose an image file" }, { status: 400 });
      }

      const saved = await saveAvatarFromFile(avatarFile, session.user.id, nextName);
      createdAvatarLocalPath = saved.absolutePath;
      createdAvatarDriveItemId = saved.driveItemId;
      nextAvatar = saved.avatarUrl;
      if (current.avatar && current.avatar !== nextAvatar) {
        oldAvatarToDelete = current.avatar;
        avatarAction = "updated";
      } else if (!current.avatar) {
        avatarAction = "uploaded";
      }
    } else if (typeof avatar === "string" || avatar === null) {
      // JSON fallback path (older clients)
      if (avatar === null || avatar.trim() === "") {
        // Ignore empty avatar payloads to avoid accidental photo wipes.
        // Actual deletion is handled only via removeAvatar=true above.
      } else {
        const trimmedAvatar = avatar.trim();
        if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmedAvatar)) {
          const saved = await saveAvatarFromDataUrl(trimmedAvatar, session.user.id, nextName);
          createdAvatarLocalPath = saved.absolutePath;
          createdAvatarDriveItemId = saved.driveItemId;
          nextAvatar = saved.avatarUrl;
          if (current.avatar && current.avatar !== nextAvatar) {
            oldAvatarToDelete = current.avatar;
            avatarAction = "updated";
          } else if (!current.avatar) {
            avatarAction = "uploaded";
          }
        } else if (
          trimmedAvatar.startsWith(`${USER_PHOTO_API_PREFIX}/`) ||
          trimmedAvatar.startsWith(`${USER_PHOTO_REL_DIR}/`) ||
          trimmedAvatar.startsWith("http://") ||
          trimmedAvatar.startsWith("https://")
        ) {
          if (current.avatar !== trimmedAvatar) {
            nextAvatar = trimmedAvatar;
            if (current.avatar) {
              oldAvatarToDelete = current.avatar;
              avatarAction = "updated";
            } else {
              avatarAction = "uploaded";
            }
          }
        } else {
          db.close();
          return NextResponse.json({ error: "Invalid avatar image" }, { status: 400 });
        }
      }
    }

    db.prepare(
      `UPDATE users SET
         name = ?,
         avatar = ?,
         bio = ?,
         github_url = ?,
         linkedin_url = ?,
         twitter_url = ?,
         website_url = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nextName,
      nextAvatar,
      nextBio,
      nextGithub,
      nextLinkedin,
      nextTwitter,
      nextWebsite,
      session.user.id
    );

    const updated = db
      .prepare("SELECT id, name, email, avatar, bio, github_url, linkedin_url, twitter_url, website_url, role FROM users WHERE id = ?")
      .get(session.user.id);
    db.close();

    if (oldAvatarToDelete && oldAvatarToDelete !== nextAvatar) {
      await deleteAvatarAsset(oldAvatarToDelete);
    }

    if (avatarAction) {
      const updatedUser = updated as { id: string; name: string; email: string; avatar: string | null };
      try {
        const excelModule = await import("@/lib/excel");
        if (typeof excelModule.upsertUserPhotoInExcel === "function") {
          await excelModule.upsertUserPhotoInExcel({
            userId: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            photoUrl: updatedUser.avatar,
            action: avatarAction,
          });
        } else {
          console.warn("[Excel] upsertUserPhotoInExcel export is not available");
        }
      } catch (excelError) {
        console.error("[Excel] Failed to sync user photo:", excelError);
      }
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    if (createdAvatarDriveItemId) {
      try {
        await deleteOneDriveItem(createdAvatarDriveItemId);
      } catch {
        // ignore cleanup errors
      }
    }

    if (createdAvatarLocalPath && fs.existsSync(createdAvatarLocalPath)) {
      try {
        fs.unlinkSync(createdAvatarLocalPath);
      } catch {
        // ignore cleanup errors
      }
    }

    console.error("PATCH /api/profile error:", err);

    if (err instanceof Error && (
      err.message.includes("under 2MB") ||
      err.message.includes("Unsupported image type") ||
      err.message.includes("Invalid avatar image")
    )) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (err instanceof Error && (
      err.message.includes("OneDrive profile photo upload failed") ||
      err.message.includes("Failed to refresh OneDrive token") ||
      err.message.includes("OneDrive not configured")
    )) {
      return NextResponse.json({ error: "Could not upload profile photo to OneDrive" }, { status: 502 });
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
