/**
 * Excel workbook manager
 * ──────────────────────
 * Keeps community submissions, advanced submissions, and
 * admin audit activity in separate Excel workbooks.
 *
 * If OneDrive is not configured, saves locally.
 */

import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

type WorkbookTarget = {
  localPath: string;
  oneDrivePath: string;
  pendingPath: string;
};

type WorkbookSnapshot = {
  exists: boolean;
  sizeBytes: number;
  sheets: Array<{ name: string; rows: number }>;
};

const COMMUNITY_WORKBOOK: WorkbookTarget = {
  localPath: path.join(process.cwd(), "data", "Community_Links.xlsx"),
  oneDrivePath: "Xreso/Community_Links.xlsx",
  pendingPath: path.join(process.cwd(), "data", "Community_Links.pending.xlsx"),
};

const ADVANCED_WORKBOOK: WorkbookTarget = {
  localPath: path.join(process.cwd(), "data", "Advanced_Tracks.xlsx"),
  oneDrivePath: "Xreso/Advanced_Tracks.xlsx",
  pendingPath: path.join(process.cwd(), "data", "Advanced_Tracks.pending.xlsx"),
};

const ADMIN_WORKBOOK: WorkbookTarget = {
  localPath: path.join(process.cwd(), "data", "Admin_Audit.xlsx"),
  oneDrivePath: "Xreso/Admin_Audit.xlsx",
  pendingPath: path.join(process.cwd(), "data", "Admin_Audit.pending.xlsx"),
};

const WORKBOOK_CONFIG = {
  community: {
    key: "community",
    label: "Community",
    primarySheet: "Community Links",
    expectedSheets: ["Community Links", "Registered Users", "User Photos"],
    target: COMMUNITY_WORKBOOK,
  },
  advanced: {
    key: "advanced",
    label: "Advanced",
    primarySheet: "Advanced Uploads",
    expectedSheets: ["Advanced Uploads"],
    target: ADVANCED_WORKBOOK,
  },
  admin: {
    key: "admin",
    label: "Admin Audit",
    primarySheet: "Admin Logins",
    expectedSheets: ["Admin Logins", "Admin Users", "Admin Actions"],
    target: ADMIN_WORKBOOK,
  },
} as const;

export type ExcelWorkbookKey = keyof typeof WORKBOOK_CONFIG;

export type ExcelStorageWorkbookStatus = {
  key: ExcelWorkbookKey;
  label: string;
  primarySheet: string;
  expectedSheets: string[];
  localPath: string;
  oneDrivePath: string;
  pendingPath: string;
  localSnapshot: WorkbookSnapshot;
  pendingSnapshot: WorkbookSnapshot;
  remoteSnapshot: WorkbookSnapshot | null;
};

export type ExcelStorageStatus = {
  mode: "local" | "onedrive";
  note: string;
  workbooks: ExcelStorageWorkbookStatus[];
};

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

const ADMIN_USER_HEADERS = [
  { header: "Added At", key: "date", width: 22 },
  { header: "Name", key: "name", width: 30 },
  { header: "Email", key: "email", width: 40 },
  { header: "Credential Status", key: "credentialStatus", width: 40 },
  { header: "Photo", key: "photo", width: 36 },
  { header: "Role", key: "role", width: 16 },
  { header: "Notes", key: "notes", width: 44 },
];

const ADMIN_LOGIN_HEADERS = [
  { header: "Login At", key: "date", width: 22 },
  { header: "Admin ID", key: "adminId", width: 38 },
  { header: "Admin Name", key: "adminName", width: 28 },
  { header: "Admin Email", key: "adminEmail", width: 36 },
  { header: "Role", key: "role", width: 16 },
  { header: "Provider", key: "provider", width: 18 },
  { header: "IP Address", key: "ipAddress", width: 24 },
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

function getWorkbookLabel(target: WorkbookTarget) {
  return path.posix.basename(target.oneDrivePath);
}

function applySheetSchema(
  sheet: ExcelJS.Worksheet,
  columns: Array<Partial<ExcelJS.Column>>,
  color: string
) {
  sheet.columns = columns;
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/* ── Create a fresh workbook ────────────────────────────── */
function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Xreso";
  workbook.created = new Date();
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

function ensureLocalDataDir(targetPath: string) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveBufferToPath(targetPath: string, buffer: Buffer) {
  ensureLocalDataDir(targetPath);
  fs.writeFileSync(targetPath, buffer);
}

async function inspectWorkbookSnapshot(filePath: string): Promise<WorkbookSnapshot> {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      sizeBytes: 0,
      sheets: [],
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  return {
    exists: true,
    sizeBytes: fs.statSync(filePath).size,
    sheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rowCount,
    })),
  };
}

async function inspectWorkbookBuffer(buffer?: Buffer): Promise<WorkbookSnapshot | null> {
  if (!buffer || buffer.length === 0) {
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);

  return {
    exists: true,
    sizeBytes: buffer.length,
    sheets: workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rowCount,
    })),
  };
}

export function getExcelWorkbookTargets() {
  return Object.values(WORKBOOK_CONFIG).map((config) => ({
    key: config.key,
    label: config.label,
    primarySheet: config.primarySheet,
    expectedSheets: [...config.expectedSheets],
    localPath: config.target.localPath,
    oneDrivePath: config.target.oneDrivePath,
    pendingPath: config.target.pendingPath,
  }));
}

export async function getExcelStorageStatus(): Promise<ExcelStorageStatus> {
  const { isOneDriveConfigured } = await import("@/lib/onedrive");
  const mode = isOneDriveConfigured() ? "onedrive" : "local";

  const workbooks = await Promise.all(
    Object.values(WORKBOOK_CONFIG).map(async (config) => {
      const remoteSnapshot =
        mode === "onedrive"
          ? await inspectWorkbookBuffer(
              await downloadExcelFromOneDrive(config.target)
            )
          : null;

      return {
        key: config.key,
        label: config.label,
        primarySheet: config.primarySheet,
        expectedSheets: [...config.expectedSheets],
        localPath: config.target.localPath,
        oneDrivePath: config.target.oneDrivePath,
        pendingPath: config.target.pendingPath,
        localSnapshot: await inspectWorkbookSnapshot(config.target.localPath),
        pendingSnapshot: await inspectWorkbookSnapshot(config.target.pendingPath),
        remoteSnapshot,
      };
    })
  );

  return {
    mode,
    note:
      mode === "onedrive"
        ? "Live writes go to OneDrive. Local workbook files are mirrors or pending fallbacks."
        : "Live writes go directly to local workbook files in the data directory.",
    workbooks,
  };
}

function loadPendingOneDriveBuffer(target: WorkbookTarget): Buffer | undefined {
  if (!fs.existsSync(target.pendingPath)) return undefined;
  return fs.readFileSync(target.pendingPath);
}

function clearPendingOneDriveBuffer(target: WorkbookTarget) {
  if (fs.existsSync(target.pendingPath)) {
    fs.unlinkSync(target.pendingPath);
  }
}

function applyCommunitySheetSchema(sheet: ExcelJS.Worksheet) {
  applySheetSchema(sheet, HEADERS, "8B5CF6");
}

function applyAdvancedSheetSchema(sheet: ExcelJS.Worksheet) {
  applySheetSchema(sheet, HEADERS, "0EA5E9");
}

function applyUserSheetSchema(sheet: ExcelJS.Worksheet) {
  applySheetSchema(sheet, USER_HEADERS, "10B981");
}

function applyUserPhotoSheetSchema(sheet: ExcelJS.Worksheet) {
  applySheetSchema(sheet, USER_PHOTO_HEADERS, "0284C7");
}

function applyAdminActionSheetSchema(sheet: ExcelJS.Worksheet) {
  applySheetSchema(sheet, ADMIN_ACTION_HEADERS, "DC2626");
}

function applyAdminUserSheetSchema(sheet: ExcelJS.Worksheet) {
  applySheetSchema(sheet, ADMIN_USER_HEADERS, "7C3AED");
}

function applyAdminLoginSheetSchema(sheet: ExcelJS.Worksheet) {
  applySheetSchema(sheet, ADMIN_LOGIN_HEADERS, "F59E0B");
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

type ExcelLinkRow = {
  noteId: string;
  title: string;
  description: string;
  category: string;
  link: string;
  author: string;
  authorEmail?: string;
  tags: string;
  license: string;
  status?: string;
};

function formatExcelStatus(status?: string) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (!normalized) return "Pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

async function loadExistingWorkbookBuffer(
  target: WorkbookTarget,
  useOneDrive: boolean
): Promise<Buffer | undefined> {
  if (useOneDrive) {
    const pendingBuffer = loadPendingOneDriveBuffer(target);
    if (pendingBuffer) return pendingBuffer;
    return downloadExcelFromOneDrive(target);
  }

  if (fs.existsSync(target.localPath)) {
    return fs.readFileSync(target.localPath);
  }

  return undefined;
}

async function saveWorkbook(
  target: WorkbookTarget,
  useOneDrive: boolean,
  buffer: Buffer,
  successLabel: string,
  deferredLabel: string
) {
  if (useOneDrive) {
    try {
      await uploadExcelToOneDrive(target, buffer);
      clearPendingOneDriveBuffer(target);
      console.log(`[Excel] ${successLabel} synced to OneDrive ${getWorkbookLabel(target)}`);
    } catch (error) {
      saveBufferToPath(target.pendingPath, buffer);
      console.warn(`[Excel] ${deferredLabel}, saved pending workbook locally:`, error);
    }
    return;
  }

  saveBufferToPath(target.localPath, buffer);
  console.log(`[Excel] ${successLabel} synced to local ${path.basename(target.localPath)}`);
}

async function appendSubmissionToExcel(
  target: WorkbookTarget,
  sheetName: string,
  schema: (sheet: ExcelJS.Worksheet) => void,
  data: ExcelLinkRow
) {
  const { isOneDriveConfigured } = await import("@/lib/onedrive");
  const useOneDrive = isOneDriveConfigured();
  const existingBuffer = await loadExistingWorkbookBuffer(target, useOneDrive);
  const workbook = await loadOrCreateWorkbook(existingBuffer);
  const sheet = ensureWorksheet(
    workbook,
    sheetName,
    sheetName === "Advanced Uploads" ? "0EA5E9" : "8B5CF6",
    schema
  );

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
    linkType,
    author: data.author,
    description: data.description,
    tags: data.tags,
    license: data.license,
    noteId: data.noteId,
    status: formatExcelStatus(data.status),
    authorEmail: data.authorEmail || "",
  });

  const linkCell = newRow.getCell("link");
  linkCell.value = {
    text: data.link,
    hyperlink: data.link,
  } as ExcelJS.CellHyperlinkValue;
  linkCell.font = { color: { argb: "0563C1" }, underline: true };

  if (newRow.number % 2 === 0) {
    newRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: sheetName === "Advanced Uploads" ? "ECFEFF" : "F5F3FF" },
    };
  }

  const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await saveWorkbook(
    target,
    useOneDrive,
    outputBuffer,
    `${sheetName} row appended`,
    `${sheetName} sync deferred`
  );
}

/* ── Append a link row to the Excel sheet ───────────────── */
export async function appendLinkToExcel(data: ExcelLinkRow): Promise<void> {
  try {
    await appendSubmissionToExcel(
      COMMUNITY_WORKBOOK,
      "Community Links",
      applyCommunitySheetSchema,
      data
    );
  } catch (error) {
    console.error("[Excel] Failed to append link:", error);
    // Non-fatal — don't block the upload
  }
}

export async function appendAdvancedLinkToExcel(data: ExcelLinkRow): Promise<void> {
  try {
    await appendSubmissionToExcel(
      ADVANCED_WORKBOOK,
      "Advanced Uploads",
      applyAdvancedSheetSchema,
      data
    );
  } catch (error) {
    console.error("[Excel] Failed to append advanced upload:", error);
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
    const existingBuffer = await loadExistingWorkbookBuffer(COMMUNITY_WORKBOOK, useOneDrive);

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
    await saveWorkbook(
      COMMUNITY_WORKBOOK,
      useOneDrive,
      outputBuffer,
      "Community status update",
      "Community status sync deferred"
    );

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
    const existingBuffer = await loadExistingWorkbookBuffer(ADMIN_WORKBOOK, useOneDrive);

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
    await saveWorkbook(
      ADMIN_WORKBOOK,
      useOneDrive,
      outputBuffer,
      "Admin action",
      "Admin action sync deferred"
    );
  } catch (error) {
    console.error("[Excel] Failed to append admin action:", error);
  }
}

export async function upsertAdminUserInExcel(data: {
  name: string;
  email: string;
  photo?: string;
  role?: string;
  notes?: string;
}): Promise<void> {
  try {
    const { isOneDriveConfigured } = await import("@/lib/onedrive");
    const useOneDrive = isOneDriveConfigured();
    const existingBuffer = await loadExistingWorkbookBuffer(ADMIN_WORKBOOK, useOneDrive);

    const workbook = await loadOrCreateWorkbook(existingBuffer);
    const sheet = ensureWorksheet(workbook, "Admin Users", "7C3AED", applyAdminUserSheetSchema);

    // Security hardening: never keep plaintext passwords in Excel rows.
    const credentialStatusText = "Password is hashed in DB (not stored in Excel)";
    for (let i = 2; i <= sheet.rowCount; i += 1) {
      const row = sheet.getRow(i);
      row.getCell("credentialStatus").value = credentialStatusText;
    }

    const normalizedEmail = data.email.trim().toLowerCase();

    let targetRow: ExcelJS.Row | null = null;
    for (let i = 2; i <= sheet.rowCount; i += 1) {
      const row = sheet.getRow(i);
      const rowEmail = cellValueToText(row.getCell("email").value).trim().toLowerCase();
      if (rowEmail === normalizedEmail) {
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
    targetRow.getCell("name").value = data.name;
    targetRow.getCell("email").value = data.email;
    targetRow.getCell("credentialStatus").value = credentialStatusText;
    targetRow.getCell("photo").value = data.photo || "Will share later";
    targetRow.getCell("role").value = data.role || "admin";
    targetRow.getCell("notes").value = data.notes || "";

    if (targetRow.number % 2 === 0) {
      targetRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F3E8FF" },
      };
    }

    const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await saveWorkbook(
      ADMIN_WORKBOOK,
      useOneDrive,
      outputBuffer,
      "Admin user",
      "Admin user sync deferred"
    );
  } catch (error) {
    console.error("[Excel] Failed to sync admin user:", error);
  }
}

export async function appendAdminLoginToExcel(data: {
  adminId: string;
  adminName: string;
  adminEmail: string;
  role: string;
  provider: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    const { isOneDriveConfigured } = await import("@/lib/onedrive");
    const useOneDrive = isOneDriveConfigured();
    const existingBuffer = await loadExistingWorkbookBuffer(ADMIN_WORKBOOK, useOneDrive);
    const workbook = await loadOrCreateWorkbook(existingBuffer);
    const sheet = ensureWorksheet(workbook, "Admin Logins", "F59E0B", applyAdminLoginSheetSchema);

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
      role: data.role,
      provider: data.provider,
      ipAddress: data.ipAddress || "",
    });

    if (row.number % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFBEB" },
      };
    }

    const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await saveWorkbook(
      ADMIN_WORKBOOK,
      useOneDrive,
      outputBuffer,
      "Admin login",
      "Admin login sync deferred"
    );
  } catch (error) {
    console.error("[Excel] Failed to append admin login:", error);
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
    const existingBuffer = await loadExistingWorkbookBuffer(COMMUNITY_WORKBOOK, useOneDrive);

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
    await saveWorkbook(
      COMMUNITY_WORKBOOK,
      useOneDrive,
      outputBuffer,
      "Registered user",
      "Registered user sync deferred"
    );
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
    const existingBuffer = await loadExistingWorkbookBuffer(COMMUNITY_WORKBOOK, useOneDrive);

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
    await saveWorkbook(
      COMMUNITY_WORKBOOK,
      useOneDrive,
      outputBuffer,
      "User photo",
      "User photo sync deferred"
    );
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

async function downloadExcelFromOneDrive(target: WorkbookTarget): Promise<Buffer | undefined> {
  try {
    const token = await getToken();
    const url = `${GRAPH_BASE}/me/drive/root:/${target.oneDrivePath}:/content`;
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

async function uploadExcelToOneDrive(target: WorkbookTarget, buffer: Buffer): Promise<void> {
  const token = await getToken();

  // Ensure Xreso folder exists
  await import("@/lib/onedrive").catch(() => null);

  const url = `${GRAPH_BASE}/me/drive/root:/${target.oneDrivePath}:/content`;
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
