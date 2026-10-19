// =========================
// VÄLJ DATABAS
// =========================

// Servern kan använda två sorters databas:
//
//   Om DATABASE_URL är satt  -> Postgres (på Render, som saknar beständig disk)
//   Annars                   -> SQLite lokalt (inget att installera)
//
// Båda erbjuder exakt samma funktioner, så resten av
// koden behöver inte bry sig om vilken som används.

let driver = null;

// Vilken databas vi valde
let anvandTyp = "Okänd";


// Välj drivrutin och förbered den
async function open() {

    if (driver) {
        return;
    }

    if (process.env.DATABASE_URL) {
        driver = require("./postgres-store");
        anvandTyp = "Postgres";
        await driver.open();
        await driver.setup();
    } else {
        driver = require("./sqlite-store");
        anvandTyp = "SQLite";
        driver.open();
    }

}


// Vilken databas används?
function typ() {
    return anvandTyp;
}


// Alla anrop går vidare till den valda drivrutinen
function skicka(namn) {

    return function() {

        if (!driver) {
            throw new Error(
                "Databasen är inte öppnad. Anropa store.open() först."
            );
        }

        return driver[namn].apply(driver, arguments);

    };

}


module.exports = {
    open,
    typ,
    addSvar: skicka("addSvar"),
    getAll: skicka("getAll"),
    count: skicka("count"),
    deleteAll: skicka("deleteAll"),
    getAdmin: skicka("getAdmin"),
    setAdmin: skicka("setAdmin"),
    createSession: skicka("createSession"),
    getSession: skicka("getSession"),
    deleteSession: skicka("deleteSession"),
    cleanupSessions: skicka("cleanupSessions")
};