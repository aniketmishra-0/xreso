import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function test() {
  try {
    const rs = await client.execute("SELECT * FROM users LIMIT 1");
    console.log(rs.columns);
  } catch(e: any) {
    console.log("Error:", e.message);
  }
}
test();
