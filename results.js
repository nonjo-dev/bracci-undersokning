// =========================
// KOMMUNIKATION MED SERVERN
// =========================

// Fel som betyder att man inte är inloggad
class AuthError extends Error {
    constructor() {
        super("Du måste vara inloggad.");
        this.name = "AuthError";
    }
}


// Prata med servern
async function api(route, options) {

    const val = options || {};

    const svar = await fetch(route, {
        method: val.method || "GET",
        headers: val.body ? { "Content-Type": "application/json" } : {},
        body: val.body ? JSON.stringify(val.body) : undefined,
        credentials: "same-origin"
    });

    // Servern svarade 401 när vi frågade efter sessionen
    if (svar.status === 401) {
        throw new AuthError();
    }

    const data = await svar.json().catch(function() {
        return {};
    });

    if (!svar.ok) {
        throw new Error(data.fel || "Något gick fel.");
    }

    return data;

}


// Servern går det att nå?
async function reachable() {

    try {
        await api("/api/session");
        return true;
    } catch (error) {
        return false;
    }

}


// Senast hämtade svaren, används av JSON-exporten
let svar = [];


// =========================
// ETIKETTER
// =========================

const FRAGA_1 = ["Ja", "Nej", "Kanske"];

const FRAGA_2 = [
    "Enkelt och stilrent",
    "Färgglatt",
    "Lyxigt",
    "Street"
];

const FRAGA_3 = [
    "Under 50 kr",
    "50-100 kr",
    "100-200 kr",
    "Över 200 kr"
];

const FRAGA_4 = ["1", "2", "3", "4", "5"];


// Ungefärligt pris för varje prisnivå, används för snittpriset
const PRIS_MEDEL = [40, 75, 150, 250];


// =========================
// STATISTIK
// =========================

// Räkna hur många gånger varje svar förekommer
function countAnswers(svar, key, order) {

    return order.map(function(value) {

        return svar.filter(function(post) {
            return post[key] === value;
        }).length;

    });

}


// Andel i procent, avrundat till heltal
function toPercent(count, total) {

    if (!total) {
        return 0;
    }

    return Math.round((count / total) * 100);

}


// Vilket alternativ som fått flest svar
function topAnswer(counts, order) {

    let best = 0;

    counts.forEach(function(count, index) {
        if (count > counts[best]) {
            best = index;
        }
    });

    return counts[best] > 0 ? order[best] : null;

}


// Snittet av designskalan
function averageDesign(svar) {

    const values = svar
        .map(function(post) { return Number(post.q4); })
        .filter(function(value) { return value >= 1 && value <= 5; });

    if (!values.length) {
        return null;
    }

    const sum = values.reduce(function(a, b) { return a + b; }, 0);

    return (sum / values.length).toFixed(1);

}


// Snittpris baserat på vald prisnivå
function averagePrice(svar) {

    let total = 0;
    let count = 0;

    svar.forEach(function(post) {

        const level = FRAGA_3.indexOf(post.q3);

        if (level >= 0) {
            total += PRIS_MEDEL[level];
            count++;
        }

    });

    if (!count) {
        return null;
    }

    return Math.round(total / count);

}


// =========================
// RITA DIAGRAM
// =========================

// Rita ett stapeldiagram med etikett, andel och antal
function renderChart(element, counts, order) {

    const total = counts.reduce(function(a, b) { return a + b; }, 0);

    element.innerHTML = "";

    order.forEach(function(value, index) {

        const percent = toPercent(counts[index], total);

        const row = document.createElement("div");
        row.className = "bar-row";

        row.innerHTML = `
            <p class="bar-label">${value}</p>

            <div class="bar-track">
                <div class="bar-fill" data-width="${percent}"></div>
            </div>

            <p class="bar-value">
                ${percent}%<span>${counts[index]} st</span>
            </p>
        `;

        element.appendChild(row);

    });

    // Animera in staplarna efter att de lagts i DOM
    requestAnimationFrame(function() {

        element.querySelectorAll(".bar-fill").forEach(function(bar) {
            bar.style.width = bar.dataset.width + "%";
        });

    });

}


// =========================
// SIDANS OLIKA LÄGEN
// =========================

const loginScreen = document.getElementById("login");
const pageHero = document.getElementById("page-hero");
const statsSection = document.getElementById("stats");
const emptyScreen = document.getElementById("empty");
const chartsSection = document.getElementById("charts");
const toolsSection = document.getElementById("tools");
const navLogout = document.getElementById("nav-logout");
const adminBadge = document.getElementById("admin-badge");
const adminEmail = document.getElementById("admin-email");


// Visa inloggningen
function showLogin() {

    loginScreen.hidden = false;
    pageHero.hidden = true;
    statsSection.hidden = true;
    emptyScreen.hidden = true;
    chartsSection.hidden = true;
    toolsSection.hidden = true;
    navLogout.hidden = true;

}


// Visa resultatet
function showDashboard() {

    loginScreen.hidden = true;
    pageHero.hidden = false;
    statsSection.hidden = false;
    navLogout.hidden = false;

}


// Visa vilket adminkonto som är inloggat
function showAdmin(email) {

    adminEmail.textContent = email || "—";

}


// Visa att servern inte svarar
function showOffline() {

    loginScreen.hidden = true;
    pageHero.hidden = true;
    statsSection.hidden = true;
    emptyScreen.hidden = false;
    chartsSection.hidden = true;
    toolsSection.hidden = true;

    emptyScreen.querySelector("h2").innerHTML =
        "Servern är <br><span>inte igång.</span>";

    emptyScreen.querySelector("p").textContent =
        "Starta servern i mappen där undersökningen ligger med " +
        "npm start, och öppna sidan via http://localhost:3000 " +
        "istället för att dubbelklicka på filen.";

    emptyScreen.querySelector("a").hidden = true;

}


// =========================
// RENDERA
// =========================

function render(svar) {

    // TOMT LÄGE
    if (!svar.length) {

        emptyScreen.hidden = false;
        chartsSection.hidden = true;
        toolsSection.hidden = true;

        document.getElementById("stat-total").textContent = "0";
        document.getElementById("stat-yes").textContent = "0%";
        document.getElementById("stat-style").textContent = "–";
        document.getElementById("stat-price").textContent = "–";
        document.getElementById("stat-design").textContent = "–";
        document.getElementById("stat-date").textContent = "–";

        return;

    }

    emptyScreen.hidden = true;

    const total = svar.length;

    const q1 = countAnswers(svar, "q1", FRAGA_1);
    const q2 = countAnswers(svar, "q2", FRAGA_2);
    const q3 = countAnswers(svar, "q3", FRAGA_3);
    const q4 = countAnswers(svar, "q4", FRAGA_4);

    // KORT
    document.getElementById("stat-total").textContent = total;

    document.getElementById("stat-yes").textContent =
        toPercent(q1[0], total) + "%";

    document.getElementById("stat-style").textContent =
        topAnswer(q2, FRAGA_2) || "–";

    const price = averagePrice(svar);
    document.getElementById("stat-price").textContent =
        price ? price + " kr" : "–";

    document.getElementById("stat-design").textContent =
        averageDesign(svar) + " / 5";

    const dates = svar
        .map(function(post) { return post.datum; })
        .filter(Boolean)
        .sort();

    document.getElementById("stat-date").textContent =
        dates.length
            ? new Date(dates[dates.length - 1]).toLocaleDateString("sv-SE")
            : "–";

    // DIAGRAM
    renderChart(document.getElementById("chart-q1"), q1, FRAGA_1);
    renderChart(document.getElementById("chart-q2"), q2, FRAGA_2);
    renderChart(document.getElementById("chart-q3"), q3, FRAGA_3);
    renderChart(document.getElementById("chart-q4"), q4, FRAGA_4);

    chartsSection.hidden = false;
    toolsSection.hidden = false;

}


// Hämta svaren och visa dem
async function loadResults() {

    try {

        const data = await api("/api/svar");

        svar = data.svar;

        render(svar);

    } catch (error) {

        // Sessionen kan ha gått ut medan sidan varit öppen.
        // Då ska vi inte lämna kvar resultatet synligt.
        if (error instanceof AuthError) {
            showLogin();
            return;
        }

        throw error;

    }

}


// Logga in och visa resultatet
async function enterDashboard() {

    const session = await api("/api/session");

    // Om servern av någon anledning inte godkänner sessionen
    // ska vi inte visa något resultat
    if (!session.inloggad) {
        showLogin();
        return;
    }

    showDashboard();
    showAdmin(session.email);

    await loadResults();

}


// =========================
// INLOGGNING
// =========================

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");


// Visa ett felmeddelande
function showError(text) {

    loginError.textContent = text;
    loginError.hidden = false;

}


// Dölj felmeddelandet
function hideError() {

    loginError.hidden = true;

}


// Logga in
loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();
    hideError();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
        showError("Fyll i e-post och lösenord.");
        return;
    }

    loginButton.textContent = "Loggar in…";
    loginButton.disabled = true;

    try {

        await api("/api/login", {
            method: "POST",
            body: { email: email, password: password }
        });

        document.getElementById("login-password").value = "";

        // Hämta inloggningen igen för att se vilket konto
        // som faktiskt är inloggat
        await enterDashboard();

    } catch (error) {

        showError(
            error instanceof AuthError
                ? "Inloggningen misslyckades."
                : error.message
        );

    } finally {

        loginButton.innerHTML = 'Logga in <span>&rarr;</span>';
        loginButton.disabled = false;

    }

});


// Logga ut
async function logout() {

    try {
        await api("/api/logout", { method: "POST" });
    } catch (error) {
        // Även om det misslyckas går vi ur vyn
    }

    showLogin();
    showHint("Du är utloggad.");

}


// =========================
// EXPORTERA OCH VERKTYG
// =========================

// Ladda ner CSV direkt från servern
function exportCSV() {
    window.location.href = "/api/svar.csv";
}


// Ladda ner JSON
function exportJSON() {

    const blob = new Blob(
        [JSON.stringify(svar, null, 2)],
        { type: "application/json" }
    );

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bracci-undersokning.json";

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(link.href);

}


// Kopiera länken till undersökningen
function copyLink() {

    const link = window.location.origin + "/";

    navigator.clipboard.writeText(link).then(function() {
        showHint("Länken är kopierad.");
    }, function() {
        showHint(link);
    });

}


// Rensa alla svar
async function clearAll() {

    if (!confirm(
        "Vill du verkligen radera alla sparade svar? " +
        "Det går inte att ångra."
    )) {
        return;
    }

    try {
        await api("/api/svar/renstra", { method: "POST" });
    } catch (error) {

        if (error instanceof AuthError) {
            showLogin();
            return;
        }

        showHint("Kunde inte rensa svaren.");
        return;

    }

    await loadResults();

    showHint("Alla svar är raderade.");

}


// Visa ett meddelande under knapparna
function showHint(text) {

    const hint = document.getElementById("tool-hint");

    hint.textContent = text;

    window.setTimeout(function() {
        hint.textContent = "";
    }, 4000);

}


// Mobilmeny
function toggleMenu() {

    const nav = document.querySelector(".navbar nav");
    const button = document.querySelector(".menu-button");

    const isOpen = nav.classList.toggle("is-open");

    button.setAttribute("aria-expanded", String(isOpen));

}


// =========================
// START
// =========================

(async function start() {

    if (!await reachable()) {
        showOffline();
        return;
    }

    try {

        const session = await api("/api/session");

        if (session.inloggad) {
            await enterDashboard();
        } else {
            showLogin();
        }

    } catch (error) {

        showOffline();

    }

})();