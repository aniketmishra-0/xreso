import { config as loadEnv } from "dotenv";
import fs from "fs";
import path from "path";
import { upsertAdminUserInExcel } from "../src/lib/excel";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  await upsertAdminUserInExcel({
    name: "Aniket Mishra",
    email: "aniketmishra492@gmail.com",
    photo: "Will share later",
    role: "admin",
    notes: "Added by admin request",
  });

  const pendingWorkbookPath = path.join(
    process.cwd(),
    "data",
    "Admin_Audit.pending.xlsx"
  );

  if (fs.existsSync(pendingWorkbookPath)) {
    console.log(
      "Admin data queued in pending workbook (OneDrive file may be open/locked). Close the workbook and rerun the script."
    );
    return;
  }

  console.log("Admin data synced to Admin_Audit.xlsx");
}

main().catch((error) => {
  console.error("Failed to add admin data to Excel:", error);
  process.exit(1);
});
