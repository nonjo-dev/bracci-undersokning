// =========================
// LAGRING I SQLITE
// =========================

// Används lokalt, när DATABASE_URL inte är satt.
// Databasen ligger i data/bracci.db och kräver ingen installation.

const { DatabaseSync } = require("node:sqlite");

const path = require("node:path");
const fs = require("node:fs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "bracci.db");


let db = null;


// Öppna databasen och skapa tabellerna
function open() {

    if (db) {
        return db;
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });

    db = new DatabaseSync(DB_FILE);

    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    setup();

    return db;

}


// Skapa tabellerna om de inte redan finns
function setup() {

    db.exec(`
        CREATE TABLE IF NOT EXISTS svar (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            skapad  TEXT    NOT NULL,
            q1      TEXT    NOT NULL,
            q2      TEXT    NOT NULL,
            q3      TEXT    NOT NULL,
            q4      INTEGER NOT NULL
        )
    `);

    db.exec("CREATE INDEX IF NOT EXISTS idx_svar_skapad ON svar(skapad)");

    db.exec(`
        CREATE TABLE IF NOT EXISTS sessioner (
            token    TEXT    PRIMARY KEY,
            skapad   INTEGER NOT NULL,
            giltig   INTEGER NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS admin (
            id    INTEGER PRIMARY KEY CHECK (id = 1),
            email TEXT NOT NULL,
            hash  TEXT NOT NULL
        )
    `);

}


// =========================
// SVAR
// =========================

async function addSvar(post) {

    const info = open().prepare(`
        INSERT INTO svar (skapad, q1, q2, q3, q4)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        new Date().toISOString(),
        post.q1, post.q2, post.q3, post.q4
    );

    return Number(info.lastInsertRowid);

}


async function getAll() {

    return open()
        .prepare("SELECT * FROM svar ORDER BY id DESC")
        .all()
        .map(function(row) {
            return {
                id: Number(row.id),
                datum: row.skapad,
                q1: row.q1,
                q2: row.q2,
                q3: row.q3,
                q4: String(row.q4)
            };
        });

}


async function count() {

    return Number(
        open().prepare("SELECT COUNT(*) AS n FROM svar").get().n
    );

}


async function deleteAll() {

    return open().prepare("DELETE FROM svar").run().changes;

}


// =========================
// ADMIN
// =========================

async function getAdmin() {

    return open()
        .prepare("SELECT email, hash FROM admin WHERE id = 1")
        .get() || null;

}


async function setAdmin(email, hash) {

    open().prepare(`
        INSERT INTO admin (id, email, hash) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET email = excluded.email, hash = excluded.hash
    `).run(email, hash);

}


// =========================
// SESSIONER
// =========================

async function createSession(token, giltig) {

    open().prepare(
        "INSERT INTO sessioner (token, skapad, giltig) VALUES (?, ?, ?)"
    ).run(token, Date.now(), giltig);

}


async function getSession(token) {

    const row = open()
        .prepare("SELECT giltig FROM sessioner WHERE token = ?")
        .get(token);

    if (!row) {
        return null;
    }

    if (Number(row.giltig) < Date.now()) {
        await deleteSession(token);
        return null;
    }

    return { giltig: Number(row.giltig) };

}


async function deleteSession(token) {

    open().prepare("DELETE FROM sessioner WHERE token = ?").run(token);

}


async function cleanupSessions() {

    open().prepare("DELETE FROM sessioner WHERE giltig < ?").run(Date.now());

    const enaVeckanSedan = Date.now() - 7 * 24 * 60 * 60 * 1000;

    open().prepare("DELETE FROM sessioner WHERE skapad < ?").run(enaVeckanSedan);

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