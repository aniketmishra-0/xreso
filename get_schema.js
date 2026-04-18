const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const rs = await client.execute("SELECT name, sql FROM sqlite_master WHERE type='table';");
  for (const row of rs.rows) {
    console.log(`--- Table: ${row.name} ---`);
    console.log(row.sql);
  }
}
run();
