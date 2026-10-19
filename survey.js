// =========================
// KONFIGURATION
// =========================

// Adressen servern lyssnar på.
// Vid lokal test: http://localhost:3000
// Lämna tomt om du hellre vill ange adressen i klienten.
const SERVER = "";


// =========================
// TILLSTÅND
// =========================

const TOTAL_STEPS = 4;

let step = 0;

// Ett svar per fråga: q1 till q4
let svar = {
    q1: "",
    q2: "",
    q3: "",
    q4: ""
};

// Nyckeln som innehåller värdet för varje fråga
const STEP_KEYS = ["q1", "q2", "q3", "q4"];


const progressLabel = document.getElementById("progress-label");
const progressBar = document.getElementById("progress-bar");
const backButton = document.getElementById("back-button");
const hint = document.getElementById("hint");
const submitButton = document.getElementById("submit-button");
const form = document.getElementById("survey-form");
const doneScreen = document.getElementById("done");
const surveyNav = document.getElementById("survey-nav");
const doneText = document.getElementById("done-text");


const questions = Array.from(
    document.querySelectorAll(".question")
);


// =========================
// NAVIGATION
// =========================

// Visa en viss fråga
function goToStep(nyStep) {

    if (nyStep < 0 || nyStep >= TOTAL_STEPS) {
        return;
    }

    step = nyStep;

    questions.forEach(function(question, index) {
        question.classList.toggle("is-active", index === step);
    });

    updateProgress();

    scrollToSurvey();

}


// Nästa fråga
function nextStep() {

    if (step >= TOTAL_STEPS - 1) {
        return;
    }

    goToStep(step + 1);

}


// Föregående fråga
function prevStep() {

    goToStep(step - 1);

}


// Uppdatera etikett och progressbar
function updateProgress() {

    progressLabel.textContent =
        "Fråga " + (step + 1) + " av " + TOTAL_STEPS;

    progressBar.style.width =
        ((step + 1) / TOTAL_STEPS) * 100 + "%";

    backButton.style.visibility =
        step === 0 ? "hidden" : "visible";

    // Sista frågan har inget alternativ att gå vidare till,
    // därför visas skickaknappen istället för tipset
    if (step === TOTAL_STEPS - 1) {
        hint.textContent = "Välj en siffra och skicka sedan";
    } else {
        hint.textContent = "Välj ett svar för att fortsätta";
    }

}


// Scrolla till undersökningen när nästa fråga visas
function scrollToSurvey() {

    const target = document.getElementById("undersokning");

    const top =
        target.getBoundingClientRect().top + window.scrollY - 90;

    window.scrollTo({
        top: top,
        behavior: "smooth"
    });

}


// =========================
// VAL
// =========================

// När ett alternativ eller en siffra klickas
function handleChoice(event) {

    const button = event.target.closest(".option, .scale-option");

    if (!button) {
        return;
    }

    const question = button.closest(".question");
    const stepIndex = Number(question.dataset.step);

    // Markera valet
    question
        .querySelectorAll(".option, .scale-option")
        .forEach(function(element) {
            element.classList.remove("is-selected");
        });

    button.classList.add("is-selected");

    // Spara värdet
    svar[STEP_KEYS[stepIndex]] = button.dataset.value;

    // Hoppa fram automatiskt, förutom på sista frågan
    if (stepIndex < TOTAL_STEPS - 1) {
        window.setTimeout(nextStep, 380);
    } else {
        submitButton.classList.add("is-ready");
    }

}


// =========================
// SKICKA
// =========================

function submitSurvey(event) {

    event.preventDefault();

    // Alla frågor måste vara besvarade
    if (STEP_KEYS.some(function(key) { return !svar[key]; })) {

        hint.textContent = "Du behöver svara på alla frågor";

        return;

    }

    skickaSvar();

}


// Serverns adress
function baseURL() {

    if (SERVER) {
        return SERVER;
    }

    // Om sidan körs via fil:// finns ingen server att prata med
    if (window.location.protocol === "file:") {
        return "";
    }

    return window.location.origin;

}


// Skicka svaret till servern
async function skickaSvar() {

    submitButton.classList.remove("is-ready");
    submitButton.innerHTML = "Skickar…";

    try {

        const svar2 = await fetch(baseURL() + "/api/svar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                q1: svar.q1,
                q2: svar.q2,
                q3: svar.q3,
                q4: svar.q4
            })
        });

        if (!svar2.ok) {
            throw new Error("Servern svarade " + svar2.status);
        }

    } catch (error) {

        // Servern är inte igång, eller något gick fel med svaret
        submitButton.classList.add("is-ready");
        submitButton.innerHTML = "Försök igen <span>→</span>";

        hint.style.color = "#a33";
        hint.textContent =
            "Kunde inte skicka. Starta servern med npm start och " +
            "öppna sidan via http://localhost:3000.";

        return;

    }

    showDone();

}


// Visa tack-sidan
function showDone() {

    document.getElementById("survey-form").hidden = true;
    surveyNav.hidden = true;
    doneScreen.hidden = false;

    // Startar celebration-animationen. Klassen sätts här,
    // efter att sektionen blivit synlig - annars körs
    // animationen innan något syns och blir överhoppad.
    doneScreen.classList.add("is-celebrating");

    doneText.textContent =
        "Ditt svar är registrerat. Tack för din tid!";

    const target = doneScreen.getBoundingClientRect().top
        + window.scrollY - 90;

    window.scrollTo({
        top: target,
        behavior: "smooth"
    });

}


// =========================
// MOBILMENY
// =========================

function toggleMenu() {

    const nav = document.querySelector(".navbar nav");
    const button = document.querySelector(".menu-button");

    const isOpen = nav.classList.toggle("is-open");

    button.setAttribute("aria-expanded", String(isOpen));

}


// =========================
// START
// =========================

form.addEventListener("click", handleChoice);

form.addEventListener("submit", submitSurvey);

// Piltangenterna fungerar som navigering
document.addEventListener("keydown", function(event) {

    if (doneScreen.hidden === false) {
        return;
    }

    if (event.key === "ArrowRight") {
        nextStep();
    }

    if (event.key === "ArrowLeft") {
        prevStep();
    }

});

updateProgress();