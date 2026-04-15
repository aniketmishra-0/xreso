/**
 * Excel sheet manager for community links
 * ─────────────────────────────────────────
 * Maintains a "Community_Links.xlsx" file in OneDrive
 * under Xreso/ folder. Every shared link gets appended
 * as a new row automatically.
 *
 * If OneDrive is not configured, saves locally.
 */

import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const LOCAL_EXCEL_PATH = path.join(process.cwd(), "data", "Community_Links.xlsx");
const ONEDRIVE_EXCEL_PATH = "Xreso/Community_Links.xlsx";
const ONEDRIVE_PENDING_EXCEL_PATH = path.join(process.cwd(), "data", "Community_Links.pending.xlsx");

/* ── Column headers for the sheet ───────────────────────── */
const HEADERS = [
  { header: "Date", key: "date", width: 18 },
  { header: "Title", key: "title", width: 35 },
  { header: "Category", key: "category", width: 18 },
  { header: "Link", key: "link", width: 50 },
  { header: "Link Type", key: "linkType", width: 18 },
  { header: "Author Name", key: "author", width: 22 },
  { header: "Description", key: "description", width: 45 },
  { header: "Tags", key: "tags", width: 30 },
  { header: "License", key: "license", width: 18 },
  { header: "Note ID", key: "noteId", width: 38 },
  { header: "Status", key: "status", width: 12 },
  { header: "Author Email", key: "authorEmail", width: 36 },
];

/* ── Column headers for Users sheet ─────────────────────── */
const USER_HEADERS = [
  { header: "Registration Date", key: "date", width: 22 },
  { header: "User ID", key: "userId", width: 38 },
  { header: "Name", key: "name", width: 30 },
  { header: "Email", key: "email", width: 40 },
];

const USER_PHOTO_HEADERS = [
  { header: "Updated At", key: "date", width: 22 },
  { header: "User ID", key: "userId", width: 38 },
  { header: "Name", key: "name", width: 30 },
  { header: "Email", key: "email", width: 40 },
  { header: "Photo URL", key: "photoUrl", width: 55 },
  { header: "Photo File", key: "photoFile", width: 36 },
  { header: "Action", key: "action", width: 14 },
];

const ADMIN_ACTION_HEADERS = [
  { header: "Date", key: "date", width: 22 },
  { header: "Admin ID", key: "adminId", width: 38 },
  { header: "Admin Name", key: "adminName", width: 28 },
  { header: "Admin Email", key: "adminEmail", width: 36 },
  { header: "Note ID", key: "noteId", width: 38 },
  { header: "Note Title", key: "noteTitle", width: 40 },
  { header: "Category", key: "category", width: 18 },
  { header: "Action", key: "action", width: 16 },
  { header: "Previous Status", key: "previousStatus", width: 16 },
  { header: "New Status", key: "newStatus", width: 16 },
  { header: "Featured", key: "featured", width: 12 },
  { header: "Details", key: "details", width: 44 },
];

/* ── Detect link type ───────────────────────────────────── */
function detectLinkType(url: string): string {
  if (!url) return "Unknown";
  if (url.includes("drive.google.com") || url.includes("docs.google.com")) return "Google Drive";
  if (url.includes("github.com")) return "GitHub";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("notion.so")) return "Notion";
  if (url.includes("dropbox.com")) return "Dropbox";
  if (url.includes("figma.com")) return "Figma";
  if (url.includes("medium.com") || url.includes("dev.to") || url.includes("hashnode")) return "Blog";
  return "Web Link";
}

/* ── Category slug → display name ───────────────────────── */
const CATEGORY_MAP: Record<string, string> = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript",
  sql: "SQL", java: "Java", "c-c++": "C/C++", "c-cpp": "C/C++",
  "data-structures": "Data Structures", algorithms: "Algorithms",
  "web-dev": "Web Dev", devops: "DevOps", react: "React",
  go: "Go", rust: "Rust", swift: "Swift", kotlin: "Kotlin",
  ruby: "Ruby", php: "PHP", other: "Other",
};

/* ── Create a fresh workbook with styled headers ────────── */
function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Xreso";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Community Links", {
    properties: { tabColor: { argb: "8B5CF6" } },
  });

  sheet.columns = HEADERS;

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "8B5CF6" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  // Freeze the header row
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook;
}

/* ── Load existing workbook or create new ───────────────── */
async function loadOrCreateWorkbook(existingBuffer?: Buffer): Promise<ExcelJS.Workbook> {
  if (existingBuffer && existingBuffer.length > 0) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(existingBuffer as never);
    return workbook;
  }
  return createWorkbook();
}

function ensureLocalDataDir() {
  const dir = path.dirname(LOCAL_EXCEL_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveBufferToPath(targetPath: string, buffer: Buffer) {
  ensureLocalDataDir();
  fs.writeFileSync(targetPath, buffer);
}

function loadPendingOneDriveBuffer(): Buffer | undefined {
  if (!fs.existsSync(ONEDRIVE_PENDING_EXCEL_PATH)) return undefined;
  return fs.readFileSync(ONEDRIVE_PENDING_EXCEL_PATH);
}

function clearPendingOneDriveBuffer() {
  if (fs.existsSync(ONEDRIVE_PENDING_EXCEL_PATH)) {
    fs.unlinkSync(ONEDRIVE_PENDING_EXCEL_PATH);
  }
}

function applyCommunitySheetSchema(sheet: ExcelJS.Worksheet) {
  sheet.columns = HEADERS;
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "8B5CF6" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function applyUserSheetSchema(sheet: ExcelJS.Worksheet) {
  sheet.columns = USER_HEADERS;
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "10B981" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function applyUserPhotoSheetSchema(sheet: ExcelJS.Worksheet) {
  sheet.columns = USER_PHOTO_HEADERS;
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "0284C7" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function applyAdminActionSheetSchema(sheet: ExcelJS.Worksheet) {
  sheet.columns = ADMIN_ACTION_HEADERS;
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "DC2626" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function ensureWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
  tabColor: string,
  schema: (sheet: ExcelJS.Worksheet) => void
) {
  const sheet =
    workbook.getWorksheet(name) ||
    workbook.addWorksheet(name, { properties: { tabColor: { argb: tabColor } } });
  schema(sheet);
  return sheet;
}

function cellValueToText(value: ExcelJS.CellValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text ?? "") : String(part)))
      .join("");
  }
  if (typeof value === "object") {
    const maybeText = value as { text?: string; result?: string | number | boolean; hyperlink?: string; richText?: Array<{ text?: string }> };
    if (typeof maybeText.text === "string") return maybeText.text;
    if (Array.isArray(maybeText.richText)) {
      return maybeText.richText.map((chunk) => chunk.text || "").join("");
    }
    if (maybeText.result !== undefined && maybeText.result !== null) return String(maybeText.result);
    if (typeof maybeText.hyperlink === "string") return maybeText.hyperlink;
  }
  return String(value);
}

/* ── Append a link row to the Excel sheet ───────────────── */
export async function appendLinkToExcel(data: {
  noteId: string;
  title: string;
  description: string;
  category: string;
  link: string;
  author: string;
  authorEmail?: string;
  tags: string;
  license: string;
}): Promise<void> {
  try {
    const { isOneDriveConfigured } = await import("@/lib/onedrive");
    const useOneDrive = isOneDriveConfigured();

    let existingBuffer: Buffer | undefined;

    if (useOneDrive) {
      existingBuffer = loadPendingOneDriveBuffer();
      if (!existingBuffer) {
        // Try to download existing Excel from OneDrive
        existingBuffer = await downloadExcelFromOneDrive();
      }
    } else {
      // Try to load from local file
      if (fs.existsSync(LOCAL_EXCEL_PATH)) {
        existingBuffer = fs.readFileSync(LOCAL_EXCEL_PATH);
      }
    }

    const workbook = await loadOrCreateWorkbook(existingBuffer);
    const sheet = workbook.getWorksheet("Community Links") || workbook.addWorksheet("Community Links");
    applyCommunitySheetSchema(sheet);

    // Add the new row
    const now = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

    const categoryName = CATEGORY_MAP[data.category] || data.category;
    const linkType = detectLinkType(data.link);

    const newRow = sheet.addRow({
      date: now,
      title: data.title,
      category: categoryName,
      link: data.link,
      linkType: linkType,
      author: data.author,
      description: data.description,
      tags: data.tags,
      license: data.license,
      noteId: data.noteId,
      status: "Pending",
      authorEmail: data.authorEmail || "",
    });

    // Style the link cell as a hyperlink
    const linkCell = newRow.getCell("link");
    linkCell.value = {
      text: data.link,
      hyperlink: data.link,
    } as ExcelJS.CellHyperlinkValue;
    linkCell.font = { color: { argb: "0563C1" }, underline: true };

    // Alternate row color
    if (newRow.number % 2 === 0) {
      newRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F5F3FF" },
      };
    }

    // Write back
    const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    if (useOneDrive) {
      try {
        await uploadExcelToOneDrive(outputBuffer);
        clearPendingOneDriveBuffer();
        console.log("[Excel] Link appended to OneDrive Community_Links.xlsx");
      } catch (error) {
        saveBufferToPath(ONEDRIVE_PENDING_EXCEL_PATH, outputBuffer);
        console.warn("[Excel] OneDrive upload failed, saved pending changes locally for retry:", error);
      }
    } else {
      // Save locally
      saveBufferToPath(LOCAL_EXCEL_PATH, outputBuffer);
      console.log("[Excel] Link appended to local Community_Links.xlsx");
    }
  } catch (error) {
    console.error("[Excel] Failed to append link:", error);
    // Non-fatal — don't block the upload
  }
}

/* ── Update status/author details for an existing link row ───────── */
export async function updateLinkStatusInExcel(data: {
  noteId: string;
  status: "Pending" | "Approved" | "Rejected";
  authorName?: string;
  authorEmail?: string;
}): Promise<boolean> {
  try {
    const { isOneDriveConfigured } = await import("@/lib/onedrive");
    const useOneDrive = isOneDriveConfigured();

    let existingBuffer: Buffer | undefined;
    if (useOneDrive) {
      existingBuffer = loadPendingOneDriveBuffer();
      if (!existingBuffer) {
        existingBuffer = await downloadExcelFromOneDrive();
      }
    } else if (fs.existsSync(LOCAL_EXCEL_PATH)) {
      existingBuffer = fs.readFileSync(LOCAL_EXCEL_PATH);
    }

    if (!existingBuffer || existingBuffer.length === 0) {
      return false;
    }

    const workbook = await loadOrCreateWorkbook(existingBuffer);
    const sheet = workbook.getWorksheet("Community Links");
    if (!sheet) return false;

    applyCommunitySheetSchema(sheet);

    let rowUpdated = false;
    for (let i = 2; i <= sheet.rowCount; i += 1) {
      const row = sheet.getRow(i);
      const noteIdInRow = cellValueToText(row.getCell("noteId").value).trim();
      if (noteIdInRow !== data.noteId) continue;

      row.getCell("status").value = data.status;
      if (data.authorName) row.getCell("author").value = data.authorName;
      if (typeof data.authorEmail === "string") row.getCell("authorEmail").value = data.authorEmail;
      rowUpdated = true;
      break;
    }

    if (!rowUpdated) {
      console.warn(`[Excel] Note ID not found for status sync: ${data.noteId}`);
      return false;
    }

    const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    if (useOneDrive) {
      try {
        await uploadExcelToOneDrive(outputBuffer);
        clearPendingOneDriveBuffer();
      } catch (error) {
        saveBufferToPath(ONEDRIVE_PENDING_EXCEL_PATH, outputBuffer);
        console.warn("[Excel] OneDrive status sync deferred, saved pending workbook locally:", error);
      }
    } else {
      saveBufferToPath(LOCAL_EXCEL_PATH, outputBuffer);
    }

    return true;
  } catch (error) {
    console.error("[Excel] Failed to update link status:", error);
    return false;
  }
}

export async function appendAdminActionToExcel(data: {
  adminId: string;
  adminName: string;
  adminEmail: string;
  noteId: string;
  noteTitle: string;
  category: string;
  action: "approved" | "rejected" | "featured" | "deleted";
  previousStatus: string;
  newStatus: string;
  featured: boolean;
  details?: string;
}): Promise<void> {
  try {
    const { isOneDriveConfigured } = await import("@/lib/onedrive");
    const useOneDrive = isOneDriveConfigured();

    let existingBuffer: Buffer | undefined;
    if (useOneDrive) {
      existingBuffer = loadPendingOneDriveBuffer();
      if (!existingBuffer) {
        existingBuffer = await downloadExcelFromOneDrive();
      }
    } else if (fs.existsSync(LOCAL_EXCEL_PATH)) {
      existingBuffer = fs.readFileSync(LOCAL_EXCEL_PATH);
    }

    const workbook = await loadOrCreateWorkbook(existingBuffer);
    const sheet = ensureWorksheet(workbook, "Admin Actions", "DC2626", applyAdminActionSheetSchema);

    const now = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

    const row = sheet.addRow({
      date: now,
      adminId: data.adminId,
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      noteId: data.noteId,
      noteTitle: data.noteTitle,
      category: data.category,
      action: data.action,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      featured: data.featured ? "Yes" : "No",
      details: data.details || "",
    });

    if (row.number % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FEF2F2" },
      };
    }

    const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    if (useOneDrive) {
      try {
        await uploadExcelToOneDrive(outputBuffer);
        clearPendingOneDriveBuffer();
        console.log("[Excel] Admin action synced to OneDrive Community_Links.xlsx");
      } catch (error) {
        saveBufferToPath(ONEDRIVE_PENDING_EXCEL_PATH, outputBuffer);
        console.warn("[Excel] OneDrive admin action sync failed, saved pending workbook locally:", error);
      }
    } else {
      saveBufferToPath(LOCAL_EXCEL_PATH, outputBuffer);
      console.log("[Excel] Admin action synced to local Community_Links.xlsx");
    }
  } catch (error) {
    console.error("[Excel] Failed to append admin action:", error);
  }
}

/* ── Append a new user to the Excel sheet ───────────────── */
export async function appendUserToExcel(data: {
  userId: string;
  name: string;
  email: string;
}): Promise<void> {
  try {
    const { isOneDriveConfigured } = await import("@/lib/onedrive");
    const useOneDrive = isOneDriveConfigured();

    let existingBuffer: Buffer | undefined;
    if (useOneDrive) {
      existingBuffer = await downloadExcelFromOneDrive();
    } else {
      if (fs.existsSync(LOCAL_EXCEL_PATH)) {
        existingBuffer = fs.readFileSync(LOCAL_EXCEL_PATH);
      }
    }

    const workbook = await loadOrCreateWorkbook(existingBuffer);
    const sheetName = "Registered Users";
    const sheet = workbook.getWorksheet(sheetName) || workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: "10B981" } } });
    applyUserSheetSchema(sheet);

    const now = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

    const newRow = sheet.addRow({
      date: now,
      userId: data.userId,
      name: data.name,
      email: data.email,
    });

    // Alternate row styling
    if (newRow.number % 2 === 0) {
      newRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "ECFDF5" },
      };
    }

    const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    if (useOneDrive) {
      await uploadExcelToOneDrive(outputBuffer);
      console.log("[Excel] User appended to OneDrive Community_Links.xlsx");
    } else {
      const dir = path.dirname(LOCAL_EXCEL_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_EXCEL_PATH, outputBuffer);
      console.log("[Excel] User appended to local Community_Links.xlsx");
    }
  } catch (error) {
    console.error("[Excel] Failed to append user:", error);
  }
}

function extractPhotoFileName(photoUrl: string | null): string {
  if (!photoUrl) return "";

  try {
    if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
      const parsed = new URL(photoUrl);
      return path.posix.basename(parsed.pathname);
    }
  } catch {
    // Fall through to path basename
  }

  return path.posix.basename(photoUrl);
}

export async function upsertUserPhotoInExcel(data: {
  userId: string;
  name: string;
  email: string;
  photoUrl: string | null;
  action: "uploaded" | "updated" | "removed";
}): Promise<void> {
  try {
    const { isOneDriveConfigured } = await import("@/lib/onedrive");
    const useOneDrive = isOneDriveConfigured();

    let existingBuffer: Buffer | undefined;
    if (useOneDrive) {
      existingBuffer = loadPendingOneDriveBuffer();
      if (!existingBuffer) {
        existingBuffer = await downloadExcelFromOneDrive();
      }
    } else if (fs.existsSync(LOCAL_EXCEL_PATH)) {
      existingBuffer = fs.readFileSync(LOCAL_EXCEL_PATH);
    }

    const workbook = await loadOrCreateWorkbook(existingBuffer);
    const sheetName = "User Photos";
    const sheet = workbook.getWorksheet(sheetName) || workbook.addWorksheet(sheetName, {
      properties: { tabColor: { argb: "0284C7" } },
    });
    applyUserPhotoSheetSchema(sheet);

    let targetRow: ExcelJS.Row | null = null;
    for (let i = 2; i <= sheet.rowCount; i += 1) {
      const row = sheet.getRow(i);
      const rowUserId = cellValueToText(row.getCell("userId").value).trim();
      if (rowUserId === data.userId) {
        targetRow = row;
        break;
      }
    }

    if (!targetRow) {
      targetRow = sheet.addRow({});
    }

    const now = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

    targetRow.getCell("date").value = now;
    targetRow.getCell("userId").value = data.userId;
    targetRow.getCell("name").value = data.name;
    targetRow.getCell("email").value = data.email;
    targetRow.getCell("action").value = data.action;

    if (data.photoUrl) {
      if (data.photoUrl.startsWith("http://") || data.photoUrl.startsWith("https://")) {
        targetRow.getCell("photoUrl").value = {
          text: data.photoUrl,
          hyperlink: data.photoUrl,
        } as ExcelJS.CellHyperlinkValue;
        targetRow.getCell("photoUrl").font = { color: { argb: "0563C1" }, underline: true };
      } else {
        targetRow.getCell("photoUrl").value = data.photoUrl;
      }
    } else {
      targetRow.getCell("photoUrl").value = "";
    }

    targetRow.getCell("photoFile").value = extractPhotoFileName(data.photoUrl);

    if (targetRow.number % 2 === 0) {
      targetRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "E0F2FE" },
      };
    }

    const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    if (useOneDrive) {
      try {
        await uploadExcelToOneDrive(outputBuffer);
        clearPendingOneDriveBuffer();
        console.log("[Excel] User photo synced to OneDrive Community_Links.xlsx");
      } catch (error) {
        saveBufferToPath(ONEDRIVE_PENDING_EXCEL_PATH, outputBuffer);
        console.warn("[Excel] OneDrive user photo sync failed, saved pending workbook locally:", error);
      }
    } else {
      saveBufferToPath(LOCAL_EXCEL_PATH, outputBuffer);
      console.log("[Excel] User photo synced to local Community_Links.xlsx");
    }
  } catch (error) {
    console.error("[Excel] Failed to sync user photo:", error);
  }
}

/* ── OneDrive helpers ───────────────────────────────────── */
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function getToken(): Promise<string> {
  // Dynamic import to avoid circular deps
  const mod = await import("@/lib/onedrive");
  // Access the internal getAccessToken — we need to export it
  // For now we'll re-implement the token fetch inline
  const tokenCachePath = path.join(process.cwd(), ".onedrive-token.json");
  let refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN || "";

  if (!refreshToken) {
    try {
      const raw = fs.readFileSync(tokenCachePath, "utf-8");
      const cached = JSON.parse(raw);
      refreshToken = cached.refresh_token || "";
    } catch {
      throw new Error("No OneDrive token available");
    }
  }

  const body = new URLSearchParams({
    client_id: process.env.ONEDRIVE_CLIENT_ID || "",
    client_secret: process.env.ONEDRIVE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "Files.ReadWrite offline_access",
  });

  const tenantId = process.env.ONEDRIVE_TENANT_ID || "common";
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error("Token refresh failed for Excel");
  const data = await res.json();

  // Save updated refresh token
  if (data.refresh_token) {
    fs.writeFileSync(tokenCachePath, JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    }, null, 2));
  }

  return data.access_token;

  // Suppress unused import warning
  void mod;
}

async function downloadExcelFromOneDrive(): Promise<Buffer | undefined> {
  try {
    const token = await getToken();
    const url = `${GRAPH_BASE}/me/drive/root:/${ONEDRIVE_EXCEL_PATH}:/content`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 404) return undefined; // File doesn't exist yet
      throw new Error(`Download failed: ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn("[Excel] Could not download from OneDrive:", error);
    return undefined;
  }
}

async function uploadExcelToOneDrive(buffer: Buffer): Promise<void> {
  const token = await getToken();

  // Ensure Xreso folder exists
  await import("@/lib/onedrive").catch(() => null);

  const url = `${GRAPH_BASE}/me/drive/root:/${ONEDRIVE_EXCEL_PATH}:/content`;
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: new Uint8Array(buffer),
    });

    if (res.ok) {
      return;
    }

    const err = await res.text();
    const isLocked = err.includes("resourceLocked") || err.includes('"code":"notAllowed"');

    if (isLocked && attempt < maxAttempts) {
      const waitMs = attempt * 1200;
      console.warn(`[Excel] OneDrive workbook locked, retrying upload (${attempt}/${maxAttempts}) in ${waitMs}ms`);
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), waitMs);
      });
      continue;
    }

    throw new Error(`Excel upload failed: ${err}`);
  }
}
