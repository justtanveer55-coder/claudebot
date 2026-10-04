const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      chat_id BIGINT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      repeat TEXT NOT NULL DEFAULT 'none',
      due TIMESTAMPTZ,
      time TEXT,
      days INTEGER[],
      done BOOLEAN DEFAULT false,
      last_sent DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

module.exports = { pool, init };
