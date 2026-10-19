// =========================
// BRACCI UF – UNDERSÖKNINGSSERVER
// =========================

// Server för undersökningen.
// Ser till att sidorna laddas, tar emot svar och
// skyddar resultaten med inloggning.
//
// Starta med:  npm start

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const store = require("./store");
const auth = require("./auth");


// =========================
// KONFIGURATION
// =========================

const ROOT = path.join(__dirname, "..");

const PORT = Number(process.env.PORT) || 3000;

// Största storlek på en inkommande begäran
const MAX_BODY = 16 * 1024;


// Läs .env utan något extra bibliotek
function loadEnv() {

    const fil = path.join(ROOT, ".env");

    if (!fs.existsSync(fil)) {
        return;
    }

    const rader = fs.readFileSync(fil, "utf8").split("\n");

    rader.forEach(function(rad) {

        const match = rad.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);

        if (!match) {
            return;
        }

        let varde = match[2].trim();

        // Ta bort citat runt värdet
        if (
            varde.length > 1 &&
            ((varde.startsWith('"') && varde.endsWith('"')) ||
             (varde.startsWith("'") && varde.endsWith("'")))
        ) {
            varde = varde.slice(1, -1);
        }

        // Miljövariabler från terminalen vinner över .env
        if (process.env[match[1]] === undefined) {
            process.env[match[1]] = varde;
        }

    });

}


// =========================
// SVARSALTERNATIV
// =========================

// Samma alternativ som visas i undersökningen.
// Används för att kontrollera att svaret är giltigt.

const GILTIGA = {
    q1: ["Ja", "Nej", "Kanske"],
    q2: ["Enkelt och stilrent", "Färgglatt", "Lyxigt", "Street"],
    q3: ["Under 50 kr", "50-100 kr", "100-200 kr", "Över 200 kr"],
    q4: ["1", "2", "3", "4", "5"]
};


// =========================
// HJÄLPFUNKTIONER
// =========================

// Skicka JSON
function sendJSON(res, status, data) {

    const text = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(text),
        "Cache-Control": "no-store"
    });

    res.end(text);

}


// Läs en JSON-body
function readJSON(req) {

    return new Promise(function(resolve, reject) {

        let stor = 0;
        let delar = [];

        req.on("data", function(chunk) {

            stor += chunk.length;

            // Stoppa för stora begäran
            if (stor > MAX_BODY) {
                reject(new Error("För stor begäran"));
                req.destroy();
                return;
            }

            delar.push(chunk);

        });

        req.on("end", function() {

            const text = Buffer.concat(delar).toString("utf8");

            if (!text) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(text));
            } catch (error) {
                reject(new Error("Ogiltig JSON"));
            }

        });

        req.on("error", reject);

    });

}


// Hämta sessionstoken från cookien
function getToken(req) {

    const raw = req.headers.cookie;

    if (!raw) {
        return null;
    }

    const match = raw.match(/(?:^|;\s*)bracci_session=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : null;

}


// Klientens IP-adress
function getIP(req) {

    return req.socket.remoteAddress || "okand";

}


// Kontrollera att alla svar ligger i rätt lista
function isValid(post) {

    for (const nyckel of Object.keys(GILTIGA)) {

        if (!GILTIGA[nyckel].includes(post[nyckel])) {
            return false;
        }

    }

    return true;

}


// Bygg CSV av svaren
function buildCSV(svar) {

    const hamna = function(varde) {
        return '"' + String(varde).replace(/"/g, '""') + '"';
    };

    const rader = [[
        "Tidpunkt", "Datum",
        "Fraga 1 - Vill koppa",
        "Fraga 2 - Stil",
        "Fraga 3 - Pris",
        "Fraga 4 - Design 1-5"
    ]];

    svar.forEach(function(post) {

        rader.push([
            post.id,
            String(post.datum).slice(0, 19).replace("T", " "),
            post.q1,
            post.q2,
            post.q3,
            post.q4
        ]);

    });

    // BOM så att Excel läser å, ä och ö rätt
    return "\uFEFF" + rader.map(function(rad) {
        return rad.map(hamna).join(";");
    }).join("\r\n");

}


// =========================
// STATISKA FILER
// =========================

// Endast dessa filer får laddas över webben.
// Det hindrar att någon kommer åt datafilen eller .env
const TILLATET = {
    "/": "index.html",
    "/index.html": "index.html",
    "/resultat.html": "resultat.html",
    "/style.css": "style.css",
    "/survey.js": "survey.js",
    "/results.js": "results.js",
    "/favicon.svg": "img/favicon.svg",
    "/img/armband.avif": "img/armband.avif",
    "/img/logga.png": "img/logga.png",
    "/img/logga.webp": "img/logga.webp",
    "/img/favicon.svg": "img/favicon.svg"
};

const INNEHALLSTYPER = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".png": "image/png",
    ".webp": "image/webp"
};


// Skicka en statisk fil
function serveStatic(res, sökväg) {

    const filnamn = TILLATET[sökväg];

    if (!filnamn) {
        return false;
    }

    const full = path.join(ROOT, filnamn);

    // Säkerhetskontroll: filen måste ligga i projektmappen
    if (!path.resolve(full).startsWith(path.resolve(ROOT) + path.sep)) {
        return false;
    }

    if (!fs.existsSync(full)) {
        return false;
    }

    const typ = INNEHALLSTYPER[path.extname(full)] || "application/octet-stream";

    res.writeHead(200, {
        "Content-Type": typ,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff"
    });

    res.end(fs.readFileSync(full));

    return true;

}


// =========================
// API
// =========================

async function handleAPI(req, res, url) {

    const metod = req.method;
    const route = url.pathname;

    // ----------------------
    // LOGGA IN
    // ----------------------

    if (metod === "POST" && route === "/api/login") {

        const ip = getIP(req);

        if (auth.isBlocked(ip)) {
            sendJSON(res, 429, {
                fel: "För många försök. Vänta en stund och försök igen."
            });
            return;
        }

        let post;

        try {
            post = await readJSON(req);
        } catch (error) {
            sendJSON(res, 400, { fel: "Ogiltig begäran" });
            return;
        }

        const email = String(post.email || "");
        const password = String(post.password || "");

        if (!email || !password) {
            sendJSON(res, 400, { fel: "Fyll i e-post och lösenord." });
            return;
        }

        const session = await auth.login(email, password);

        if (!session) {
            auth.registerFail(ip);
            sendJSON(res, 401, { fel: "Fel e-post eller lösenord." });
            return;
        }

        auth.resetForsok(ip);

        res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": auth.buildCookie(session.token)
        });

        res.end(JSON.stringify({ ok: true }));

        return;

    }

    // ----------------------
    // LOGGA UT
    // ----------------------

    if (metod === "POST" && route === "/api/logout") {

        await auth.logout(getToken(req));

        res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": auth.clearCookie()
        });

        res.end(JSON.stringify({ ok: true }));

        return;

    }

    // ----------------------
    // ÄR MAN INLOGGAD?
    // ----------------------

    if (metod === "GET" && route === "/api/session") {

        const inloggad = await auth.isLoggedIn(getToken(req));

        // Skicka med vilket konto som är inloggat,
        // så att sidan kan visa vem som tittar
        const admin = inloggad ? await store.getAdmin() : null;

        sendJSON(res, 200, {
            inloggad: inloggad,
            email: admin ? admin.email : null
        });

        return;

    }

    // ----------------------
    // SKICKA SVAR
    // ----------------------

    if (metod === "POST" && route === "/api/svar") {

        let post;

        try {
            post = await readJSON(req);
        } catch (error) {
            sendJSON(res, 400, { fel: "Ogiltig begäran" });
            return;
        }

        if (!isValid(post)) {
            sendJSON(res, 400, { fel: "Svaret är inte komplett." });
            return;
        }

        const id = await store.addSvar({
            q1: post.q1,
            q2: post.q2,
            q3: post.q3,
            q4: Number(post.q4)
        });

        sendJSON(res, 201, { ok: true, id: id });

        return;

    }

    // ----------------------
    // HÄMTA SVAR
    // ----------------------

    if (metod === "GET" && route === "/api/svar") {

        if (!await auth.isLoggedIn(getToken(req))) {
            sendJSON(res, 401, { fel: "Du måste vara inloggad." });
            return;
        }

        sendJSON(res, 200, {
            antal: await store.count(),
            svar: await store.getAll()
        });

        return;

    }

    // ----------------------
    // LADDA NER CSV
    // ----------------------

    if (metod === "GET" && route === "/api/svar.csv") {

        if (!await auth.isLoggedIn(getToken(req))) {
            sendJSON(res, 401, { fel: "Du måste vara inloggad." });
            return;
        }

        const csv = buildCSV(await store.getAll());

        res.writeHead(200, {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
                'attachment; filename="bracci-undersokning.csv"',
            "Content-Length": Buffer.byteLength(csv)
        });

        res.end(csv);

        return;

    }

    // ----------------------
    // RENSA SVAR
    // ----------------------

    if (metod === "POST" && route === "/api/svar/renstra") {

        if (!await auth.isLoggedIn(getToken(req))) {
            sendJSON(res, 401, { fel: "Du måste vara inloggad." });
            return;
        }

        const antal = await store.deleteAll();

        sendJSON(res, 200, { ok: true, raderade: antal });

        return;

    }

    sendJSON(res, 404, { fel: "Okänd adress." });

}


// =========================
// SERVER
// =========================

const server = http.createServer(function(req, res) {

    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));

    // Vissa headers på alla svar
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");

    if (url.pathname.startsWith("/api/")) {

        handleAPI(req, res, url).catch(function(error) {

            console.error("Fel i API:", error);

            sendJSON(res, 500, { fel: "Något gick fel." });

        });

        return;

    }

    if (req.method !== "GET" && req.method !== "HEAD") {
        sendJSON(res, 405, { fel: "Metoden är inte tillåten." });
        return;
    }

    if (serveStatic(res, url.pathname)) {
        return;
    }

    // Sidan finns inte
    res.writeHead(404, {
        "Content-Type": "text/html; charset=utf-8"
    });

    res.end("<h1>404</h1><p>Sidan hittades inte.</p>");

});


// Städa bort gamla sessioner en gång i timmen
setInterval(function() {
    store.cleanupSessions().catch(function(error) {
        console.error("Kunde inte städa sessioner:", error.message);
    });
}, 60 * 60 * 1000).unref();


// =========================
// START
// =========================

(async function start() {

    loadEnv();

    await store.open();
    await auth.ensureAdmin();

    server.listen(PORT, function() {

        console.log("");
        console.log("  Braccì UF – undersökningen är igång");
        console.log("  ---------------------------------");
        console.log("  Databas:   " + store.typ());
        console.log("  Undersökning:  http://localhost:" + PORT + "/");
        console.log("  Resultat:      http://localhost:" + PORT + "/resultat.html");
        console.log("");
        console.log("  Stoppa servern med Ctrl + C");
        console.log("");

        warnForRender();

    });

})().catch(function(error) {

    console.error("");
    console.error("  Servern kunde inte starta:");
    console.error("  " + error.message);
    console.error("");

    process.exit(1);

});


// =========================
// VARNING FÖR RENDER
// =========================

// Render fria webbtjänster saknar beständig disk.
// Varje omstart, omdeploy eller vila raderar då databasen.
function warnForRender() {

    if (!process.env.RENDER || process.env.DATABASE_URL) {
        return;
    }

    console.log("");
    console.log("  ⚠  VARNING: DEN HÄR TJÄNSTEN LAGRAR DATABASEN PÅ DISK");
    console.log("");
    console.log("  Render raderar alla filer på serverns disk varje gång den");
    console.log("  startas om, går i vila eller deployas. Alla svar som");
    console.log("  samlas in kommer alltså att försvinna.");
    console.log("");
    console.log("  Lösningarna är att använda Render Postgres, en extern");
    console.log("  databas, eller betala för en tjänst med beständig disk.");
    console.log("");
    console.log("  Se README.md, avsnittet Publicera på Render.");
    console.log("");

}