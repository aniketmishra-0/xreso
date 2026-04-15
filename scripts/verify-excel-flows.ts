import { config as loadEnv } from "dotenv";
import ExcelJS from "exceljs";
import fs from "fs";
import {
  appendAdminLoginToExcel,
  appendAdvancedLinkToExcel,
  appendLinkToExcel,
  getExcelStorageStatus,
  getExcelWorkbookTargets,
  type ExcelWorkbookKey,
} from "../src/lib/excel";

loadEnv({ path: ".env.local" });
loadEnv();

type SheetCheck = {
  key: ExcelWorkbookKey;
  sheetName: string;
  headerName: string;
  marker: string;
};

function cellToText(value: ExcelJS.CellValue | undefined | null): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "object" && part && "text" in part) {
          return String((part as { text?: string }).text || "");
        }
        return String(part);
      })
      .join("");
  }
  if (typeof value === "object") {
    const maybe = value as {
      text?: string;
      result?: string | number | boolean;
      hyperlink?: string;
      richText?: Array<{ text?: string }>;
    };
    if (typeof maybe.text === "string") return maybe.text;
    if (Array.isArray(maybe.richText)) {
      return maybe.richText.map((chunk) => chunk.text || "").join("");
    }
    if (maybe.result !== undefined && maybe.result !== null) {
      return String(maybe.result);
    }
    if (typeof maybe.hyperlink === "string") {
      return maybe.hyperlink;
    }
  }
  return String(value);
}

function assertThat(condition: boolean, passMessage: string, failMessage: string, failures: string[]) {
  if (condition) {
    console.log(`[PASS] ${passMessage}`);
    return;
  }
  console.error(`[FAIL] ${failMessage}`);
  failures.push(failMessage);
}

async function workbookHasMarker(
  filePath: string,
  sheetName: string,
  headerName: string,
  marker: string
): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return false;

  const headerRow = sheet.getRow(1);
  let markerColumn = -1;

  for (let i = 1; i <= headerRow.cellCount; i += 1) {
    if (cellToText(headerRow.getCell(i).value).trim() === headerName) {
      markerColumn = i;
      break;
    }
  }

  if (markerColumn === -1) {
    return false;
  }

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (cellToText(row.getCell(markerColumn).value).trim() === marker) {
      return true;
    }
  }

  return false;
}

async function workbookContainsValueAnywhere(filePath: string, marker: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  for (const sheet of workbook.worksheets) {
    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      for (let col = 1; col <= row.cellCount; col += 1) {
        if (cellToText(row.getCell(col).value).trim() === marker) {
          return true;
        }
      }
    }
  }

  return false;
}

async function checkMarkerInWorkbook(
  check: SheetCheck,
  workbookFiles: string[]
): Promise<{ found: boolean; file: string | null }> {
  for (const filePath of workbookFiles) {
    if (
      await workbookHasMarker(filePath, check.sheetName, check.headerName, check.marker)
    ) {
      return { found: true, file: filePath };
    }
  }

  return { found: false, file: null };
}

async function main() {
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
  const communityMarker = `verify-community-${runId}`;
  const advancedMarker = `verify-advanced-${runId}`;
  const adminMarker = `verify-admin-${runId}`;

  console.log("Running Excel workflow verification...");

  await appendAdminLoginToExcel({
    adminId: adminMarker,
    adminName: "Workflow Verifier",
    adminEmail: "verifier@xreso.dev",
    role: "admin",
    provider: "verification-script",
    ipAddress: "127.0.0.1",
  });

  await appendLinkToExcel({
    noteId: communityMarker,
    title: "Verification Community Resource",
    description: "Workbook routing verification entry.",
    category: "javascript",
    link: "https://example.com/community-verification",
    author: "Workflow Verifier",
    authorEmail: "verifier@xreso.dev",
    tags: "verification,community",
    license: "CC-BY-4.0",
    status: "pending",
  });

  await appendAdvancedLinkToExcel({
    noteId: advancedMarker,
    title: "Verification Advanced Resource",
    description: "Workbook routing verification entry.",
    category: "Cloud Native",
    link: "https://example.com/advanced-verification",
    author: "Workflow Verifier",
    authorEmail: "verifier@xreso.dev",
    tags: "verification,advanced",
    license: "CC-BY-4.0",
    status: "pending",
  });

  const status = await getExcelStorageStatus();
  const targets = new Map(getExcelWorkbookTargets().map((item) => [item.key, item]));

  const failures: string[] = [];

  console.log(`Storage mode: ${status.mode}`);

  assertThat(
    status.workbooks.length === 3,
    "Storage status returns all workbook tracks.",
    `Expected 3 storage workbooks, got ${status.workbooks.length}.`,
    failures
  );

  for (const workbook of status.workbooks) {
    const target = targets.get(workbook.key);
    assertThat(
      Boolean(target),
      `${workbook.key}: workbook target is registered.`,
      `${workbook.key}: workbook target missing in configuration.`,
      failures
    );

    if (!target) continue;

    assertThat(
      workbook.oneDrivePath === target.oneDrivePath,
      `${workbook.label}: OneDrive path mapping is correct.`,
      `${workbook.label}: OneDrive path mismatch.`,
      failures
    );

    assertThat(
      workbook.localPath === target.localPath,
      `${workbook.label}: local path mapping is correct.`,
      `${workbook.label}: local path mismatch.`,
      failures
    );

    assertThat(
      workbook.expectedSheets.includes(workbook.primarySheet),
      `${workbook.label}: primary sheet is part of expected sheet list.`,
      `${workbook.label}: primary sheet missing from expected sheet list.`,
      failures
    );
  }

  const workbookFiles = {
    community: [targets.get("community")?.localPath, targets.get("community")?.pendingPath].filter(
      (filePath): filePath is string => Boolean(filePath)
    ),
    advanced: [targets.get("advanced")?.localPath, targets.get("advanced")?.pendingPath].filter(
      (filePath): filePath is string => Boolean(filePath)
    ),
    admin: [targets.get("admin")?.localPath, targets.get("admin")?.pendingPath].filter(
      (filePath): filePath is string => Boolean(filePath)
    ),
  };

  const checks: SheetCheck[] = [
    {
      key: "community",
      sheetName: "Community Links",
      headerName: "Note ID",
      marker: communityMarker,
    },
    {
      key: "advanced",
      sheetName: "Advanced Uploads",
      headerName: "Note ID",
      marker: advancedMarker,
    },
    {
      key: "admin",
      sheetName: "Admin Logins",
      headerName: "Admin ID",
      marker: adminMarker,
    },
  ];

  for (const check of checks) {
    const files = workbookFiles[check.key];
    const existingFiles = files.filter((filePath) => fs.existsSync(filePath));

    assertThat(
      existingFiles.length > 0,
      `${check.key}: workbook file exists for verification.`,
      `${check.key}: no local/pending workbook file found.`,
      failures
    );

    const result = await checkMarkerInWorkbook(check, existingFiles);
    assertThat(
      result.found,
      `${check.key}: marker found in ${check.sheetName}${result.file ? ` (${result.file})` : ""}.`,
      `${check.key}: marker not found in ${check.sheetName}.`,
      failures
    );
  }

  const misplacedChecks = [
    {
      marker: communityMarker,
      wrongWorkbooks: [...workbookFiles.advanced, ...workbookFiles.admin],
      label: "community marker",
    },
    {
      marker: advancedMarker,
      wrongWorkbooks: [...workbookFiles.community, ...workbookFiles.admin],
      label: "advanced marker",
    },
    {
      marker: adminMarker,
      wrongWorkbooks: [...workbookFiles.community, ...workbookFiles.advanced],
      label: "admin marker",
    },
  ];

  for (const entry of misplacedChecks) {
    let foundInWrongWorkbook = false;
    for (const filePath of entry.wrongWorkbooks) {
      if (await workbookContainsValueAnywhere(filePath, entry.marker)) {
        foundInWrongWorkbook = true;
        break;
      }
    }

    assertThat(
      !foundInWrongWorkbook,
      `${entry.label} stayed in the expected workbook.`,
      `${entry.label} leaked into an unexpected workbook.`,
      failures
    );
  }

  if (failures.length > 0) {
    console.error("\nVerification failed with the following issues:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log("\nExcel workflow verification passed.");
}

main().catch((error) => {
  console.error("Excel workflow verification crashed:", error);
  process.exit(1);
});
