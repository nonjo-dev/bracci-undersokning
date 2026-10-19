// =========================
// LAGRING I POSTGRES
// =========================

// Används när DATABASE_URL är satt, alltså på Render.
// Render och andra molnleverantörer lagrar inte filer,
// så där behöver svaren ligga i en riktig databas.

const { Pool } = require("pg");

let pool = null;


// =========================
// ANSLUTNING
// =========================

function open() {

    if (pool) {
        return pool;
    }

    const url = process.env.DATABASE_URL;

    // Lokala databaser kör ofta utan kryptering
    const lokal = /localhost|127\.0\.0\.1/.test(url);

    pool = new Pool({
        connectionString: url,
        ssl: lokal ? false : { rejectUnauthorized: false },
        max: 3
    });

    return pool;

}


// Skapa tabellerna om de inte redan finns
async function setup() {

    await open().query(`
        CREATE TABLE IF NOT EXISTS svar (
            id      SERIAL PRIMARY KEY,
            skapad  TIMESTAMPTZ NOT NULL,
            q1      TEXT    NOT NULL,
            q2      TEXT    NOT NULL,
            q3      TEXT    NOT NULL,
            q4      INTEGER NOT NULL
        )
    `);

    await open().query(
        "CREATE INDEX IF NOT EXISTS idx_svar_skapad ON svar(skapad)"
    );

    await open().query(`
        CREATE TABLE IF NOT EXISTS sessioner (
            token  TEXT PRIMARY KEY,
            skapad BIGINT NOT NULL,
            giltig BIGINT NOT NULL
        )
    `);

    await open().query(`
        CREATE TABLE IF NOT EXISTS admin (
            id    INTEGER PRIMARY KEY,
            email TEXT NOT NULL,
            hash  TEXT NOT NULL
        )
    `);

}


// =========================
// SVAR
// =========================

// Spara ett svar
async function addSvar(post) {

    const res = await open().query(
        `INSERT INTO svar (skapad, q1, q2, q3, q4)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
            new Date().toISOString(),
            post.q1, post.q2, post.q3, post.q4
        ]
    );

    return res.rows[0].id;

}


// Hämta alla svar, nyast först
async function getAll() {

    const res = await open().query("SELECT * FROM svar ORDER BY id DESC");

    return res.rows.map(function(row) {

        return {
            id: Number(row.id),
            // Postgres ger tillbaka ett Date-objekt
            datum: new Date(row.skapad).toISOString(),
            q1: row.q1,
            q2: row.q2,
            q3: row.q3,
            q4: String(row.q4)
        };

    });

}


// Antal svar
async function count() {

    const res = await open().query("SELECT COUNT(*) AS n FROM svar");

    return Number(res.rows[0].n);

}


// Ta bort alla svar
async function deleteAll() {

    const res = await open().query("DELETE FROM svar");

    return res.rowCount;

}


// =========================
// ADMIN
// =========================

async function getAdmin() {

    const res = await open().query(
        "SELECT email, hash FROM admin WHERE id = 1"
    );

    return res.rows[0] || null;

}


async function setAdmin(email, hash) {

    await open().query(
        `INSERT INTO admin (id, email, hash) VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET email = $1, hash = $2`,
        [email, hash]
    );

}


// =========================
// SESSIONER
// =========================

async function createSession(token, giltig) {

    await open().query(
        "INSERT INTO sessioner (token, skapad, giltig) VALUES ($1, $2, $3)",
        [token, Date.now(), giltig]
    );

}


async function getSession(token) {

    const res = await open().query(
        "SELECT giltig FROM sessioner WHERE token = $1",
        [token]
    );

    const row = res.rows[0];

    if (!row) {
        return null;
    }

    const giltig = Number(row.giltig);

    if (giltig < Date.now()) {
        await deleteSession(token);
        return null;
    }

    return { giltig };

}


async function deleteSession(token) {

    await open().query(
        "DELETE FROM sessioner WHERE token = $1",
        [token]
    );

}


async function cleanupSessions() {

    await open().query("DELETE FROM sessioner WHERE giltig < $1", [Date.now()]);

    const enaVeckanSedan = Date.now() - 7 * 24 * 60 * 60 * 1000;

    await open().query("DELETE FROM sessioner WHERE skapad < $1", [enaVeckanSedan]);

}


module.exports = {
    open,
    setup,
    addSvar,
    getAll,
    count,
    deleteAll,
    getAdmin,
    setAdmin,
    createSession,
    getSession,
    deleteSession,
    cleanupSessions
};