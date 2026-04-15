import Database from "better-sqlite3";
import path from "path";

const emailArg = process.argv[2]?.trim();

if (!emailArg) {
  console.error("Usage: npm run user:make-admin -- <email>");
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "xreso.db");
const sqlite = new Database(dbPath);

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

try {
  const user = sqlite
    .prepare(
      "SELECT id, name, email, role FROM users WHERE lower(email) = lower(?) LIMIT 1"
    )
    .get(emailArg) as UserRow | undefined;

  if (!user) {
    console.error(`User not found for email: ${emailArg}`);
    process.exit(1);
  }

  if (user.role === "admin") {
    console.log(`User ${user.email} is already an admin.`);
    process.exit(0);
  }

  sqlite
    .prepare("UPDATE users SET role = 'admin', updated_at = datetime('now') WHERE id = ?")
    .run(user.id);

  console.log(`Success: ${user.email} is now an admin.`);
} finally {
  sqlite.close();
}
