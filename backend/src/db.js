// Accès à la base PostgreSQL (driver officiel "pg", pool de connexions).
// Paramètres lus dans backend/.env (voir .env.example).
const fs = require('fs');
const path = require('path');
const { Pool, Client, types } = require('pg');
const { seed } = require('../database/seed');

// Conversion des types PostgreSQL -> JavaScript
types.setTypeParser(20, (v) => parseInt(v, 10));           // BIGINT (COUNT, SUM) -> nombre
types.setTypeParser(1700, (v) => parseFloat(v));           // NUMERIC -> nombre
types.setTypeParser(1082, (v) => v);                        // DATE -> 'YYYY-MM-DD' (sans décalage horaire)
types.setTypeParser(1184, (v) => new Date(v).toISOString()); // TIMESTAMPTZ -> ISO 8601 (UTC)

// Toutes les dates et heures (horaires d'ouverture, « aujourd'hui »…) sont évaluées à l'heure de Tunis
const config = {
  options: `-c TimeZone=${process.env.APP_TIMEZONE || 'Africa/Tunis'}`,
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'parkeasy',
};

let pool = null;

/** Convertit les paramètres « ? » en paramètres PostgreSQL $1, $2, … */
const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

/** Fonctions d'accès, utilisables sur le pool ou sur une transaction */
function api(runner) {
  const q = (sql, params = []) => runner.query(toPg(sql), params);
  return {
    /** SELECT -> tableau d'objets */
    all: async (sql, params) => (await q(sql, params)).rows,
    /** SELECT -> premier objet ou undefined */
    get: async (sql, params) => (await q(sql, params)).rows[0],
    /** INSERT ... RETURNING id -> id créé */
    insert: async (sql, params) => (await q(`${sql} RETURNING id`, params)).rows[0].id,
    /** UPDATE / DELETE / INSERT -> nombre de lignes modifiées */
    run: async (sql, params) => (await q(sql, params)).rowCount,
    /** Requête déjà écrite avec $1, $2… */
    raw: (sql, params) => runner.query(sql, params),
  };
}

const db = {
  ...api({ query: (...a) => pool.query(...a) }),
  /** Exécute fn(tx) dans une transaction (tout ou rien) */
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await fn(api(client));
      await client.query('COMMIT');
      return res;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

/** Crée la base si elle n'existe pas encore (connexion à la base système "postgres") */
async function ensureDatabase() {
  const admin = new Client({ ...config, database: 'postgres' });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${config.database.replace(/"/g, '')}"`);
      console.log(`[db] Base "${config.database}" créée`);
    }
  } finally {
    await admin.end();
  }
}

async function initDb({ reset = false } = {}) {
  try {
    await ensureDatabase();
  } catch (e) {
    console.error(`\n[db] Connexion à PostgreSQL impossible (${config.user}@${config.host}:${config.port}).`);
    console.error('     Vérifiez que PostgreSQL est lancé et que backend/.env contient le bon mot de passe.');
    console.error(`     Détail : ${e.message}\n`);
    throw e;
  }
  if (!pool) pool = new Pool(config);

  // Correctif Objectif 04 : la table testée s'appelle « users » (l'ancien nom faisait recréer la base à chaque démarrage)
  const exists = await db.get(`SELECT to_regclass('public.users') AS t`);
  if (reset || !exists.t) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));
    await db.transaction((tx) => seed(tx));
    console.log('[db] Schéma créé et peuplé avec les données de démonstration');
  }
  await runMigrations();
  return db;
}

/** Applique les migrations idempotentes de database/migrations (ordre alphabétique) */
async function runMigrations() {
  const dir = path.join(__dirname, '..', 'database', 'migrations');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
}

async function closeDb() {
  await pool?.end();
  pool = null;
}

module.exports = { db, initDb, closeDb, config };
