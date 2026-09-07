const express = require('express');
const cors = require('cors');
const { waitForDatabase, pool } = require('./db');
const tasksRouter = require('./routes/tasks');

const APP_PORT = Number(process.env.APP_PORT) || 8080;
// Permissive by design for classroom simplicity -- a production deployment
// would restrict this to known origins instead of '*'.
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/api/status', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'unreachable' });
  }
});

app.use('/api/tasks', tasksRouter);

waitForDatabase().then(() => {
  app.listen(APP_PORT, () => console.log(`[server] listening on :${APP_PORT}`));
});
