const express = require('express');
const { pool } = require('../db');

const router = express.Router();
const VALID_STATUSES = ['pending', 'in_progress', 'done'];

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'task not found' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { title, description, status } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }
  const { rows } = await pool.query(
    'INSERT INTO tasks (title, description, status) VALUES ($1, $2, COALESCE($3, \'pending\')) RETURNING *',
    [title, description || null, status || null],
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { title, description, status } = req.body;
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }
  const { rows } = await pool.query(
    `UPDATE tasks SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       status = COALESCE($3, status)
     WHERE id = $4 RETURNING *`,
    [title || null, description || null, status || null, req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'task not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'task not found' });
  res.status(204).end();
});

module.exports = router;
