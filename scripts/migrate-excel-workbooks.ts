import { config as loadEnv } from "dotenv";
import { createClient } from "@libsql/client";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

loadEnv({ path: ".env.local" });
loadEnv();

const DATA_DIR = path.join(process.cwd(), "data");
const SOURCE_WORKBOOK_PATH = path.join(DATA_DIR, "Community_Links.xlsx");
const ADVANCED_WORKBOOK_PATH = path.join(DATA_DIR, "Advanced_Tracks.xlsx");
const ADMIN_WORKBOOK_PATH = path.join(DATA_DIR, "Admin_Audit.xlsx");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const TOKEN_CACHE_PATH = path.join(process.cwd(), ".onedrive-token.json");
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TENANT_ID = process.env.ONEDRIVE_TENANT_ID || "common";
const COMMUNITY_ONEDRIVE_PATH = "Xreso/Community_Links.xlsx";
const ADVANCED_ONEDRIVE_PATH = "Xreso/Advanced_Tracks.xlsx";
const ADMIN_ONEDRIVE_PATH = "Xreso/Admin_Audit.xlsx";

const COMMUNITY_COLUMNS = [
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
] satisfies Array<Partial<ExcelJS.Column>>;

const ADMIN_USER_COLUMNS = [
  { header: "Added At", key: "date", width: 22 },
  { header: "Name", key: "name", width: 30 },
  { header: "Email", key: "email", width: 40 },
  { header: "Credential Status", key: "credentialStatus", width: 40 },
  { header: "Photo", key: "photo", width: 36 },
  { header: "Role", key: "role", width: 16 },
  { header: "Notes", key: "notes", width: 44 },
] satisfies Array<Partial<ExcelJS.Column>>;

const ADMIN_ACTION_COLUMNS = [
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
] satisfies Array<Partial<ExcelJS.Column>>;

const ADMIN_LOGIN_COLUMNS = [
  { header: "Login At", key: "date", width: 22 },
  { header: "Admin ID", key: "adminId", width: 38 },
  { header: "Admin Name", key: "adminName", width: 28 },
  { header: "Admin Email", key: "adminEmail", width: 36 },
  { header: "Role", key: "role", width: 16 },
  { header: "Provider", key: "provider", width: 18 },
  { header: "IP Address", key: "ipAddress", width: 24 },
] satisfies Array<Partial<ExcelJS.Column>>;

type ColumnKey =
  | "date"
  | "title"
  | "category"
  | "link"
  | "linkType"
  | "author"
  | "description"
  | "tags"
  | "license"
  | "noteId"
  | "status"
  | "authorEmail"
  | "adminId"
  | "adminName"
  | "adminEmail"
  | "action"
  | "previousStatus"
  | "newStatus"
  | "featured"
  | "details"
  | "name"
  | "email"
  | "credentialStatus"
  | "photo"
  | "role"
  | "notes"
  | "noteTitle"
  | "provider"
  | "ipAddress";

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

function ensureSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Array<Partial<ExcelJS.Column>>,
  color: string
) {
  const sheet =
    workbook.getWorksheet(name) ||
    workbook.addWorksheet(name, { properties: { tabColor: { argb: color } } });
  applySheetSchema(sheet, columns, color);
  return sheet;
}

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Xreso";
  workbook.created = new Date();
  return workbook;
}

function getStoredRefreshToken() {
  if (process.env.ONEDRIVE_REFRESH_TOKEN?.trim()) {
    return process.env.ONEDRIVE_REFRESH_TOKEN.trim();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, "utf8"));
    return typeof raw.refresh_token === "string" ? raw.refresh_token : "";
  } catch {
    return "";
  }
}

function isOneDriveConfigured() {
  return Boolean(
    process.env.ONEDRIVE_CLIENT_ID &&
      process.env.ONEDRIVE_CLIENT_SECRET &&
      getStoredRefreshToken()
  );
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.ONEDRIVE_CLIENT_ID || "",
    client_secret: process.env.ONEDRIVE_CLIENT_SECRET || "",
    refresh_token: getStoredRefreshToken(),
    grant_type: "refresh_token",
    scope: "Files.ReadWrite offline_access",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (data.refresh_token) {
    const nextTokenCache = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
    fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(nextTokenCache, null, 2));
  }

  return data.access_token;
}

async function downloadOneDriveWorkbook(oneDrivePath: string) {
  const token = await getAccessToken();
  const res = await fetch(
    `${GRAPH_BASE}/me/drive/root:/${oneDrivePath}:/content`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.status === 404) {
    return undefined;
  }

  if (!res.ok) {
    throw new Error(`${oneDrivePath}: ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function uploadOneDriveWorkbook(oneDrivePath: string, buffer: Buffer) {
  const token = await getAccessToken();
  const res = await fetch(
    `${GRAPH_BASE}/me/drive/root:/${oneDrivePath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: new Uint8Array(buffer),
    }
  );

  if (!res.ok) {
    throw new Error(`${oneDrivePath}: ${await res.text()}`);
  }
}

async function loadWorkbook(filePath: string, oneDrivePath?: string) {
  const workbook = createWorkbook();
  if (oneDrivePath && isOneDriveConfigured()) {
    const remoteBuffer = await downloadOneDriveWorkbook(oneDrivePath);
    if (remoteBuffer) {
      await workbook.xlsx.load(remoteBuffer as never);
      return { workbook, sourceBuffer: remoteBuffer };
    }
  }

  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
    return { workbook, sourceBuffer: fs.readFileSync(filePath) };
  }

  return { workbook, sourceBuffer: undefined };
}

function cellValueToText(value: ExcelJS.CellValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((part) =>
        typeof part === "object" && part && "text" in part ? String(part.text ?? "") : String(part)
      )
      .join("");
  }
  if (typeof value === "object") {
    const maybeText = value as {
      text?: string;
      result?: string | number | boolean;
      hyperlink?: string;
      richText?: Array<{ text?: string }>;
    };

    if (typeof maybeText.text === "string") return maybeText.text;
    if (Array.isArray(maybeText.richText)) {
      return maybeText.richText.map((chunk) => chunk.text || "").join("");
    }
    if (maybeText.result !== undefined && maybeText.result !== null) return String(maybeText.result);
    if (typeof maybeText.hyperlink === "string") return maybeText.hyperlink;
  }
  return String(value);
}

function getHeaderMap(sheet: ExcelJS.Worksheet) {
  const headerMap = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellValueToText(cell.value).trim();
    if (header) headerMap.set(header, colNumber);
  });
  return headerMap;
}

function getRowValue(
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  headerName: string
) {
  const columnIndex = headerMap.get(headerName);
  if (!columnIndex) return undefined;
  return row.getCell(columnIndex).value;
}

function getRowObject(
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  mapping: Partial<Record<ColumnKey, string>>
): Partial<Record<ColumnKey, ExcelJS.CellValue | string>> {
  const result: Partial<Record<ColumnKey, ExcelJS.CellValue | string>> = {};

  for (const [key, headerName] of Object.entries(mapping) as Array<[ColumnKey, string]>) {
    const value = getRowValue(row, headerMap, headerName);
    result[key] = value ?? "";
  }

  return result;
}

function normalizeLinkCell(value: ExcelJS.CellValue | string | undefined) {
  const text = cellValueToText(value as ExcelJS.CellValue);
  if (!text) return "";

  if (typeof value === "object" && value && !Array.isArray(value)) {
    const maybeHyperlink = value as { hyperlink?: string; text?: string };
    if (typeof maybeHyperlink.hyperlink === "string" && maybeHyperlink.hyperlink) {
      return {
        text: maybeHyperlink.text || maybeHyperlink.hyperlink,
        hyperlink: maybeHyperlink.hyperlink,
      } satisfies ExcelJS.CellHyperlinkValue;
    }
  }

  if (/^https?:\/\//i.test(text)) {
    return {
      text,
      hyperlink: text,
    } satisfies ExcelJS.CellHyperlinkValue;
  }

  return text;
}

function ensureAlternateFill(row: ExcelJS.Row, color: string) {
  if (row.number % 2 !== 0) return;
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
}

function addCommunityRow(
  sheet: ExcelJS.Worksheet,
  data: Partial<Record<ColumnKey, ExcelJS.CellValue | string>>,
  alternateColor: string
) {
  const row = sheet.addRow({
    date: cellValueToText(data.date as ExcelJS.CellValue),
    title: cellValueToText(data.title as ExcelJS.CellValue),
    category: cellValueToText(data.category as ExcelJS.CellValue),
    link: cellValueToText(data.link as ExcelJS.CellValue),
    linkType: cellValueToText(data.linkType as ExcelJS.CellValue),
    author: cellValueToText(data.author as ExcelJS.CellValue),
    description: cellValueToText(data.description as ExcelJS.CellValue),
    tags: cellValueToText(data.tags as ExcelJS.CellValue),
    license: cellValueToText(data.license as ExcelJS.CellValue),
    noteId: cellValueToText(data.noteId as ExcelJS.CellValue),
    status: cellValueToText(data.status as ExcelJS.CellValue),
    authorEmail: cellValueToText(data.authorEmail as ExcelJS.CellValue),
  });

  const linkCell = row.getCell("link");
  linkCell.value = normalizeLinkCell(data.link);
  if (typeof linkCell.value === "object" && linkCell.value && "hyperlink" in linkCell.value) {
    linkCell.font = { color: { argb: "0563C1" }, underline: true };
  }

  ensureAlternateFill(row, alternateColor);
}

function addGenericRow(
  sheet: ExcelJS.Worksheet,
  data: Partial<Record<ColumnKey, ExcelJS.CellValue | string>>,
  alternateColor: string,
  linkKeys: ColumnKey[] = []
) {
  const row = sheet.addRow(
    Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, cellValueToText(value as ExcelJS.CellValue)])
    )
  );

  for (const linkKey of linkKeys) {
    const columnNumber =
      sheet.columns.findIndex((column) => column.key === linkKey) + 1;
    if (columnNumber <= 0) continue;
    const cell = row.getCell(columnNumber);
    const original = data[linkKey];
    cell.value = normalizeLinkCell(original);
    if (typeof cell.value === "object" && cell.value && "hyperlink" in cell.value) {
      cell.font = { color: { argb: "0563C1" }, underline: true };
    }
  }

  ensureAlternateFill(row, alternateColor);
}

function buildSignature(row: Partial<Record<ColumnKey, ExcelJS.CellValue | string>>, keys: ColumnKey[]) {
  return keys.map((key) => cellValueToText(row[key] as ExcelJS.CellValue).trim().toLowerCase()).join("|");
}

async function main() {
  if (!fs.existsSync(SOURCE_WORKBOOK_PATH)) {
    if (!isOneDriveConfigured()) {
      console.log("No Community_Links.xlsx found, nothing to migrate.");
      return;
    }
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `Community_Links.pre-split-${timestamp}.xlsx`);

  const { workbook: sourceWorkbook, sourceBuffer } = await loadWorkbook(
    SOURCE_WORKBOOK_PATH,
    COMMUNITY_ONEDRIVE_PATH
  );
  if (sourceBuffer) {
    fs.writeFileSync(backupPath, sourceBuffer);
  }

  const { workbook: advancedWorkbook } = await loadWorkbook(
    ADVANCED_WORKBOOK_PATH,
    ADVANCED_ONEDRIVE_PATH
  );
  const { workbook: adminWorkbook } = await loadWorkbook(
    ADMIN_WORKBOOK_PATH,
    ADMIN_ONEDRIVE_PATH
  );

  const sourceCommunitySheet = ensureSheet(
    sourceWorkbook,
    "Community Links",
    COMMUNITY_COLUMNS,
    "8B5CF6"
  );
  const advancedSheet = ensureSheet(
    advancedWorkbook,
    "Advanced Uploads",
    COMMUNITY_COLUMNS,
    "0EA5E9"
  );
  const adminUsersSheet = ensureSheet(
    adminWorkbook,
    "Admin Users",
    ADMIN_USER_COLUMNS,
    "7C3AED"
  );
  const adminActionsSheet = ensureSheet(
    adminWorkbook,
    "Admin Actions",
    ADMIN_ACTION_COLUMNS,
    "DC2626"
  );
  const adminLoginsSheet = ensureSheet(
    adminWorkbook,
    "Admin Logins",
    ADMIN_LOGIN_COLUMNS,
    "F59E0B"
  );

  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("TURSO_DATABASE_URL is not configured. Set it in .env.local");
  }
  const tursoClient = createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const advancedIdsResult = await tursoClient.execute("SELECT id FROM advanced_track_resources");
  const advancedIds = new Set(
    advancedIdsResult.rows.map((row) => String(row.id))
  );

  const advancedExistingIds = new Set<string>();
  advancedSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const noteId = cellValueToText(row.getCell("noteId").value).trim();
    if (noteId) advancedExistingIds.add(noteId);
  });

  const communityHeaderMap = getHeaderMap(sourceCommunitySheet);
  const communityRowsToDelete: number[] = [];
  let advancedRowsMoved = 0;

  for (let rowNumber = 2; rowNumber <= sourceCommunitySheet.rowCount; rowNumber += 1) {
    const row = sourceCommunitySheet.getRow(rowNumber);
    const noteId = cellValueToText(getRowValue(row, communityHeaderMap, "Note ID")).trim();
    if (!noteId || !advancedIds.has(noteId) || advancedExistingIds.has(noteId)) {
      continue;
    }

    const rowData = getRowObject(row, communityHeaderMap, {
      date: "Date",
      title: "Title",
      category: "Category",
      link: "Link",
      linkType: "Link Type",
      author: "Author Name",
      description: "Description",
      tags: "Tags",
      license: "License",
      noteId: "Note ID",
      status: "Status",
      authorEmail: "Author Email",
    });

    addCommunityRow(advancedSheet, rowData, "ECFEFF");
    advancedExistingIds.add(noteId);
    communityRowsToDelete.push(rowNumber);
    advancedRowsMoved += 1;
  }

  communityRowsToDelete.sort((a, b) => b - a).forEach((rowNumber) => {
    sourceCommunitySheet.spliceRows(rowNumber, 1);
  });
  applySheetSchema(sourceCommunitySheet, COMMUNITY_COLUMNS, "8B5CF6");

  const adminSheetConfigs = [
    {
      name: "Admin Users",
      destination: adminUsersSheet,
      columns: ADMIN_USER_COLUMNS,
      color: "F3E8FF",
      mapping: {
        date: "Added At",
        name: "Name",
        email: "Email",
        credentialStatus: "Credential Status",
        photo: "Photo",
        role: "Role",
        notes: "Notes",
      } satisfies Partial<Record<ColumnKey, string>>,
      signatureKeys: ["email"] as ColumnKey[],
    },
    {
      name: "Admin Actions",
      destination: adminActionsSheet,
      columns: ADMIN_ACTION_COLUMNS,
      color: "FEF2F2",
      mapping: {
        date: "Date",
        adminId: "Admin ID",
        adminName: "Admin Name",
        adminEmail: "Admin Email",
        noteId: "Note ID",
        noteTitle: "Note Title",
        category: "Category",
        action: "Action",
        previousStatus: "Previous Status",
        newStatus: "New Status",
        featured: "Featured",
        details: "Details",
      } satisfies Partial<Record<ColumnKey, string>>,
      signatureKeys: ["date", "adminId", "noteId", "action"] as ColumnKey[],
    },
    {
      name: "Admin Logins",
      destination: adminLoginsSheet,
      columns: ADMIN_LOGIN_COLUMNS,
      color: "FFFBEB",
      mapping: {
        date: "Login At",
        adminId: "Admin ID",
        adminName: "Admin Name",
        adminEmail: "Admin Email",
        role: "Role",
        provider: "Provider",
        ipAddress: "IP Address",
      } satisfies Partial<Record<ColumnKey, string>>,
      signatureKeys: ["date", "adminId", "provider", "ipAddress"] as ColumnKey[],
    },
  ];

  const movedAdminSheets: string[] = [];

  for (const config of adminSheetConfigs) {
    const sourceSheet = sourceWorkbook.getWorksheet(config.name);
    if (!sourceSheet || sourceSheet.rowCount <= 1) {
      if (sourceSheet) {
        sourceWorkbook.removeWorksheet(sourceSheet.id);
      }
      continue;
    }

    applySheetSchema(sourceSheet, config.columns, "FFFFFF");
    const headerMap = getHeaderMap(sourceSheet);
    const existingSignatures = new Set<string>();

    config.destination.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData = getRowObject(row, getHeaderMap(config.destination), config.mapping);
      existingSignatures.add(buildSignature(rowData, config.signatureKeys));
    });

    for (let rowNumber = 2; rowNumber <= sourceSheet.rowCount; rowNumber += 1) {
      const row = sourceSheet.getRow(rowNumber);
      const rowData = getRowObject(row, headerMap, config.mapping);
      const signature = buildSignature(rowData, config.signatureKeys);
      if (!signature || existingSignatures.has(signature)) continue;
      addGenericRow(config.destination, rowData, config.color, ["photo"]);
      existingSignatures.add(signature);
    }

    sourceWorkbook.removeWorksheet(sourceSheet.id);
    movedAdminSheets.push(config.name);
  }

  const sourceBufferOut =
    (await sourceWorkbook.xlsx.writeBuffer()) as unknown as Buffer;
  const advancedBufferOut =
    (await advancedWorkbook.xlsx.writeBuffer()) as unknown as Buffer;
  const adminBufferOut =
    (await adminWorkbook.xlsx.writeBuffer()) as unknown as Buffer;

  fs.writeFileSync(SOURCE_WORKBOOK_PATH, sourceBufferOut);
  fs.writeFileSync(ADVANCED_WORKBOOK_PATH, advancedBufferOut);
  fs.writeFileSync(ADMIN_WORKBOOK_PATH, adminBufferOut);

  if (isOneDriveConfigured()) {
    await uploadOneDriveWorkbook(COMMUNITY_ONEDRIVE_PATH, sourceBufferOut);
    await uploadOneDriveWorkbook(ADVANCED_ONEDRIVE_PATH, advancedBufferOut);
    await uploadOneDriveWorkbook(ADMIN_ONEDRIVE_PATH, adminBufferOut);
  }

  console.log(
    JSON.stringify(
      {
        backupPath,
        advancedRowsMoved,
        movedAdminSheets,
        sourceWorkbook: SOURCE_WORKBOOK_PATH,
        advancedWorkbook: ADVANCED_WORKBOOK_PATH,
        adminWorkbook: ADMIN_WORKBOOK_PATH,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Excel workbook migration failed:", error);
  process.exit(1);
});
