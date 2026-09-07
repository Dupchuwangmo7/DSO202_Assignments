const { Pool } = require('pg');

// Every value comes from the environment -- no default points at a real
// host, user, or password, only local-dev placeholders for documentation.
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'devdb',
  user: process.env.DB_USER || 'devuser',
  password: process.env.DB_PASSWORD || 'devpass',
});

const RETRY_DELAY_MS = 2000;

// Unit I scope has no readiness probe, so the process itself must not
// exit when the database Pod isn't up yet -- it waits it out instead.
async function waitForDatabase() {
  for (;;) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] connected');
      return;
    } catch (err) {
      console.log(`[db] not reachable yet (${err.code || err.message}), retrying in ${RETRY_DELAY_MS}ms`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

module.exports = { pool, waitForDatabase };
