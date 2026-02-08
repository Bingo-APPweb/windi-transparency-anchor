// src/db.js — PostgreSQL connection pool
const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || "postgres://windi:windi_dev_password@localhost:5432/windi";
    pool = new Pool({ connectionString });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, close };
