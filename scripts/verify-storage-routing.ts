import { config as loadEnv } from "dotenv";
import { getExcelStorageStatus } from "../src/lib/excel";

loadEnv({ path: ".env.local" });
loadEnv();

function summarizeSheets(
  snapshot:
    | {
        exists: boolean;
        sheets: Array<{ name: string; rows: number }>;
      }
    | null
) {
  if (!snapshot?.exists || snapshot.sheets.length === 0) {
    return "none";
  }

  return snapshot.sheets
    .map((sheet) => `${sheet.name}(${sheet.rows})`)
    .join(", ");
}

async function main() {
  const status = await getExcelStorageStatus();
  const failures: string[] = [];

  console.log(`Storage mode: ${status.mode}`);
  console.log(status.note);
  console.log("");

  for (const workbook of status.workbooks) {
    const liveSnapshot =
      status.mode === "onedrive"
        ? workbook.remoteSnapshot
        : workbook.localSnapshot;
    const missingSheets = workbook.expectedSheets.filter(
      (sheet) => !liveSnapshot?.sheets.some((entry) => entry.name === sheet)
    );

    console.log(`• ${workbook.label}`);
    console.log(
      `  Live target: ${
        status.mode === "onedrive" ? workbook.oneDrivePath : workbook.localPath
      }`
    );
    console.log(`  Primary sheet: ${workbook.primarySheet}`);
    console.log(`  Expected sheets: ${workbook.expectedSheets.join(", ")}`);
    console.log(`  Live snapshot: ${summarizeSheets(liveSnapshot)}`);
    console.log(
      `  Local mirror: ${summarizeSheets(workbook.localSnapshot)}`
    );
    console.log(
      `  Pending fallback: ${summarizeSheets(workbook.pendingSnapshot)}`
    );

    if (status.mode === "local") {
      if (!workbook.localSnapshot.exists) {
        failures.push(`${workbook.label}: local workbook missing`);
      }
    } else if (liveSnapshot && !liveSnapshot.exists) {
      console.log("  Warning: remote workbook has not been created yet.");
    }

    if (missingSheets.length > 0 && liveSnapshot?.exists) {
      failures.push(
        `${workbook.label}: missing live sheets (${missingSheets.join(", ")})`
      );
    }

    if (workbook.pendingSnapshot.exists) {
      failures.push(
        `${workbook.label}: pending fallback workbook exists (${workbook.pendingPath})`
      );
    }

    console.log("");
  }

  if (failures.length > 0) {
    console.error("Storage verification failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log("Storage verification passed.");
}

main().catch((error) => {
  console.error("Failed to verify storage routing:", error);
  process.exit(1);
});
