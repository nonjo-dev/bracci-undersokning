// =========================
// LÖSENORD OCH SESSIONER
// =========================

const {
    randomBytes,
    scryptSync,
    timingSafeEqual
} = require("node:crypto");

const store = require("./store");


// Så länge en inloggning håller sig giltig
const SESSIONSTID = 12 * 60 * 60 * 1000; // 12 timmar


// =========================
// LÖSENORD
// =========================

// Hasha ett lösenord med scrypt och ett slumpat salt
function hashPassword(password) {

    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");

    return "scrypt:" + salt + ":" + hash;

}


// Kontrollera ett lösenord mot en sparad hash
function verifyPassword(password, sparad) {

    const delar = String(sparad).split(":");

    if (delar.length !== 3 || delar[0] !== "scrypt") {
        return false;
    }

    const salt = delar[1];
    const forvantad = Buffer.from(delar[2], "hex");

    const testad = scryptSync(password, salt, 64);

    // timingSafeEqual kräver lika långa buffertar
    if (testad.length !== forvantad.length) {
        return false;
    }

    return timingSafeEqual(testad, forvantad);

}


// Skapa ett slumpat lösenord
function generatePassword() {

    const tecken = "abcdefghijkmnpqrstuvwxyz23456789";

    let ord = "";

    for (let i = 0; i < 16; i++) {
        ord += tecken[randomBytes(1)[0] % tecken.length];
    }

    return ord;

}


// =========================
// ADMIN
// =========================

// Kolla att det finns inloggningsuppgifter, och skapa dem vid behov
async function ensureAdmin() {

    const email = (process.env.BRACCI_EMAIL || "").trim().toLowerCase();
    const password = process.env.BRACCI_PASSWORD || "";

    const nuvarande = await store.getAdmin();

    // Första körningen
    if (!nuvarande) {

        if (email && password) {

            await store.setAdmin(email, hashPassword(password));

            console.log("Inloggning skapad från .env: " + email);

            return;
        }

        const skapat = generatePassword();

        await store.setAdmin(email || "admin@bracci.se", hashPassword(skapat));

        console.log("");
        console.log("  ┌──────────────────────────────────────────┐");
        console.log("  │  INLOGGNING SKAPAD – spara detta!        │");
        console.log("  └──────────────────────────────────────────┘");
        console.log("   E-post:  " + (email || "admin@bracci.se"));
        console.log("   Lösenord: " + skapat);
        console.log("");
        console.log("   Lägg in dina egna uppgifter i .env");
        console.log("   och starta om servern om du vill byta.");
        console.log("");

        return;
    }

    // Har miljövariablerna ändrats sedan sist?
    if (password && (
        !verifyPassword(password, nuvarande.hash) ||
        email !== nuvarande.email
    )) {

        await store.setAdmin(email || nuvarande.email, hashPassword(password));

        console.log("Inloggning uppdaterad från .env: " + email);

    }

}


// =========================
// SESSIONER
// =========================

// Skapa en session och returnera token
async function login(email, password) {

    const admin = await store.getAdmin();

    if (!admin) {
        return null;
    }

    // Jämför mailadressen utan att avslöja om den stämmer
    const emailStammer = email.toLowerCase().trim() === admin.email;

    // Kontrollera lösenordet ändå, så att svarstiden blir lika
    // oavsett om mailadressen fanns
    const passwordStammer = verifyPassword(password, admin.hash);

    if (!emailStammer || !passwordStammer) {
        return null;
    }

    const token = randomBytes(32).toString("hex");
    const giltig = Date.now() + SESSIONSTID;

    await store.createSession(token, giltig);

    return { token, giltig };

}


// Logga ut
async function logout(token) {

    if (token) {
        await store.deleteSession(token);
    }

}


// Kontrollera om en token är giltig
async function isLoggedIn(token) {

    if (!token) {
        return false;
    }

    return (await store.getSession(token)) !== null;

}


// Bygg cookie-strängen för en session
function buildCookie(token) {

    return [
        "bracci_session=" + token,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Max-Age=" + Math.floor(SESSIONSTID / 1000)
    ].join("; ");

}


// Bygg cookie-strängen som rensar sessionen
function clearCookie() {

    return "bracci_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";

}


// =========================
// SPÄRR MOT FÖRSÖK
// =========================

const MAX_FORSOK = 10;
const SPARRTID = 15 * 60 * 1000; // 15 minuter

const forsok = new Map();


// En ip får göra MAX_FORSOK försök per SPARRTID
function isBlocked(ip) {

    const nu = Date.now();
    const post = forsok.get(ip);

    if (!post || post.tom === nu) {
        forsok.set(ip, { antal: 0, tom: nu + SPARRTID });
        return false;
    }

    return post.antal >= MAX_FORSOK;

}


// Registrera ett misslyckat försök
function registerFail(ip) {

    const post = forsok.get(ip);

    // Fönstret är fortfarande öppet
    if (post && post.tom > Date.now()) {
        post.antal++;
        return;
    }

    // Nytt fönster
    forsok.set(ip, { antal: 1, tom: Date.now() + SPARRTID });

}


// Nollställ efter ett lyckat försök
function resetForsok(ip) {

    forsok.delete(ip);

}


module.exports = {
    SESSIONSTID,
    hashPassword,
    verifyPassword,
    generatePassword,
    ensureAdmin,
    login,
    logout,
    isLoggedIn,
    buildCookie,
    clearCookie,
    isBlocked,
    registerFail,
    resetForsok
};