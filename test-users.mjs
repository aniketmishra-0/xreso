import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function test() {
  try {
    const r = await client.execute(`
      SELECT u.id, u.name, u.email, COALESCE(u.role, 'user') as role, u.image, COALESCE(u.created_at, CURRENT_TIMESTAMP) as created_at,
        (SELECT COUNT(*) FROM notes WHERE author_id = u.id) as note_count,
        (SELECT COALESCE(SUM(view_count),0) FROM notes WHERE author_id = u.id) as total_views
      FROM users u
      ORDER BY u.created_at DESC
    `);
    console.log("Success! Rows:", r.rows.length);
  } catch(e) {
    console.log("Query Error:", e.message);
  }
}
test();
