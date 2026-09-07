-- Seed schema for the DSO202 Task Tracker.
-- Runs once, on first init of an empty PGDATA volume, via the official
-- postgres image's /docker-entrypoint-initdb.d/ mechanism.

CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'done')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tasks (title, description, status) VALUES
    ('Set up kind cluster',          'Bring up the local cluster from Practical 1', 'done'),
    ('Write namespace manifest',     'One namespace for all assignment resources', 'in_progress'),
    ('Wire ConfigMap and Secret',    'DB_* and POSTGRES_* must carry matching values', 'pending');
