import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });
dotenv.config();

const emails = process.argv.slice(2).map(e => e.trim().toLowerCase()).filter(Boolean);

if (emails.length === 0) {
  console.error("Usage: npm run user:make-admin -- <email1> <email2> ...");
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Error: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set in environment.");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function processEmail(emailArg: string) {
  try {
    const result = await client.execute({
      sql: "SELECT id, name, email, role FROM users WHERE lower(email) = ? LIMIT 1",
      args: [emailArg]
    });

    const user = result.rows[0];

    if (!user) {
      // User doesn't exist yet, so we pre-create their account as an admin.
      // So when they log in via Google, they keep the admin role.
      const userId = crypto.randomUUID();
      const generatedName = emailArg.split("@")[0] || "Admin";
      
      await client.execute({
        sql: "INSERT INTO users (id, name, email, password, avatar, role, premium_access, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, 'admin', 0, datetime('now'), datetime('now'))",
        args: [userId, generatedName, emailArg]
      });
      console.log(`✨ Created new admin account for ${emailArg}. (Ready for Google Login)`);
      return;
    }

    if (user.role === "admin") {
      console.log(`✅ User ${user.email} is already an admin.`);
      return;
    }

    await client.execute({
      sql: "UPDATE users SET role = 'admin', updated_at = datetime('now') WHERE id = ?",
      args: [user.id]
    });

    console.log(`🚀 Success: existing user ${user.email} is now an admin.`);
  } catch (error) {
    console.error(`❌ Database error for ${emailArg}:`, error);
  }
}

async function run() {
  for (const email of emails) {
    await processEmail(email);
  }
  process.exit(0);
}

run();
