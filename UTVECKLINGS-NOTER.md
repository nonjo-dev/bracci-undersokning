# Utvecklingsnoter — Braccì UF marknadsundersökning

Det här dokumentet samlar allt som är värt att veta om projektet: hur det
fungerar, vad som ändrats och varför, vilka problem som finns kvar och hur
man testar.

Senast uppdaterad: 2026-10-20

---

## 1. Projektet i korthet

En fyrafrågig marknadsundersökning för Braccì UF. Svaren skickas till en
Node-server, lagras i en databas och visas i en skyddad resultatsida med
diagram.

| | |
|---|---|
| Undersökning | https://bracci-undersokning.onrender.com/ |
| Resultat (inloggning) | https://bracci-undersokning.onrender.com/resultat.html |
| Repos | https://github.com/nonjo-dev/bracci-undersokning |
| Originalsajten | https://nonjo-dev.github.io/bracci/ |
| Stack | Node 24, ingen frontend-byggkedja, ett enda beroende (`pg`) |

Filstruktur:

```
index.html            Undersökningen (hero, frågor, tack-sida)
resultat.html         Inloggning + resultat med diagram
style.css             All design (~1 400 rader)
survey.js             Undersökningslogiken
results.js            Inloggning, statistik, diagram
server/
  server.js           HTTP-server, routing, filservering, validering
  auth.js             Lösenordshashning, sessioner, spärr mot försök
  store.js            Väljer databas utifrån DATABASE_URL
  sqlite-store.js     Lokal lagring (data/bracci.db)
  postgres-store.js   Lagring på Render
img/
  logga.png           Braccì-monogrammet (800×800, krämvit bakgrund)
  logga.webp          Samma bild i webp (14,5 KB)
  favicon.svg         Sidens favicon
render.yaml           Render-inställningar (Blueprint)
.github/workflows/
  keep-render-awake.yml   Håller Render-tjänsten vaken
.env.example          Mall för .env
```

---

## 2. Snabbstart lokalt

```powershell
cd Desktop\bracci-marknadsundersokning
Copy-Item .env.example .env      # fyll i BRACCI_EMAIL och BRACCI_PASSWORD
npm start
```

Servern svarar på `http://localhost:3000` (undersökningen) och
`http://localhost:3000/resultat.html` (resultat).

Inget behöver installeras lokalt — SQLite är inbyggt i Node. Kräver Node
23.4 eller senare (`.node-version` anger 24).

`.env` får aldrig laddas upp. Den ligger i `.gitignore` tillsammans med
`data/`.

---

## 3. Miljövariabler

| Variabel | Var | Vad den gör |
|---|---|---|
| `BRACCI_EMAIL` | Render → Environment | Kontot som får logga in |
| `BRACCI_PASSWORD` | Render → Environment | Lösenordet, minst 8 tecken |
| `DATABASE_URL` | Render → Environment | Postgres-adress. **Sätt den — se avsnitt 5** |
| `PORT` | valfri | Porten servern lyssnar på, default 3000 |

Servern läser `.env` själv utan något extra bibliotek
(`server/server.js`, funktionen `loadEnv`). Miljövariabler som sätts i
terminalen vinner över `.env`.

---

## 4. Deploy på Render

Tjänsten skapades från `render.yaml` som ett Blueprint. Render deployar
automatiskt varje gång `main` uppdateras, så det räcker att pusha.

- **Auto-deploy:** påslaget — varje push till `main` deployas
- **Health check:** `/api/session` (satt i `render.yaml`)
- **Region:** Frankfurt
- **Plan:** free

### Hålla tjänsten vaken

Render free-planens webbtjänster somnar efter 15 minuter utan trafik, och
nästa besökare får vänta upp till en minut medan servern startar.

`.github/workflows/keep-render-awake.yml` är en GitHub Action som pinger
`/api/session` var 14:e minut. Varje anrop räknas som trafik, så tjänsten
sover aldrig.

**Den måste aktiveras manuellt en gång:**

1. Öppna repot → fliken **Actions**
2. Välj **Håll Render vaken**
3. Klicka **Run workflow** → **Run workflow**

> Health check hjälper inte på free-planen. Render skickar health checks
> för att hitta trasiga instanser, inte för att hålla free-tjänster vakna.
> Se Render docs, "Spinning down on idle".

### Vill du slippa vänta helt?

Betald plan (7 $/månad) — då är tjänsten alltid igång och workflow-filen
kan tas bort.

---

## 5. Databasen — viktigast i det här dokumentet

`server/store.js` väljer databas automatiskt:

| `DATABASE_URL` | Databas | Var filerna hamnar |
|---|---|---|
| Satt | Postgres | Permanent, överlever omstarter |
| Inte satt | SQLite | `data/bracci.db` på serverns disk |

### 🔴 Problem just nu: `DATABASE_URL` är inte satt

Utan `DATABASE_URL` kör tjänsten SQLite på Render's **ephemera disk**, som
rensas varje gång servern startar om. **Då försvinner alla insamlade svar.**

Verifierat 2026-10-20 med ett 18-minutersprov:

```
Skickat test-svar   -> {"antal":1,"svar":[{"id":2,...}]}
18 min senare        -> {"antal":0,"svar":[]}
```

Inloggningen fungerar ändå, eftersom `ensureAdmin()` i `server/auth.js`
skapar om adminkontot från `BRACCI_EMAIL`/`BRACCI_PASSWORD` när databasen
är tom. Det är lätt att tro att allt fungerar — men svaren är borta.

### Så här fixar du det

**1. Skapa en gratis Postgres på Neon** (eller Aiven — båda har fria planer
utan tidsgräns):

- Gå till [neon.tech](https://neon.tech), skapa konto och ett projekt
- Neon ger en adress som ser ut så här:
  ```
  postgres://anvandare:losenord@ep-xxx.databases.neon.tech/neondb?sslmode=require
  ```

**2. Sätt den på Render:**

- Render → **bracci-undersokning** → **Environment**
- **Add Environment Variable** → Key: `DATABASE_URL` → Value: hela adressen
- **Save Changes** → tjänsten startar om

**3. Verifiera:**

- Render → **Logs** → du ska se `Databas: Postgres` (inte `SQLite`)
- Skicka ett svar, vänta 20 minuter, kontrollera att det finns kvar

> Använd **inte** Render's egen gratisdatabas — den raderas efter 30 dagar.
> Neon och Aiven har inga sådana gränser.

Ingen kodändring behövs. `server/store.js` och `server/postgres-store.js`
hanterar allt; servern skapar tabellerna själv första gången den startar.

---

## 6. Kända problem och öppna punkter

| # | Sak | Allvarlighet | Status |
|---|---|---|---|
| 1 | `DATABASE_URL` inte satt → svar förloras vid varje omstart | 🔴 kritisk | **Olöst** — se avsnitt 5 |
| 2 | Lösenordet finns i git-historiken (commit `963ca25`) | 🟠 viktig | **Olöst** — lösenordet har bytts? Nej. Se nedan |
| 3 | Keep-alive-workflowen är pushad men inte aktiverad | 🟡 mindre | **Olöst** — kräver ett klick i Actions |
| 4 | `img/favicon.svg` är fortfarande den gamla faviconen | 🟢 kosmetiskt | Valfritt — originalet använder `logga.png` |
| 5 | Render free-plan har 750 timmar/månad | 🟢 info | Tjänsten kör ~720 timmar. Funkar, men tight |

### Om punkt 2 — lösenordet i historiken

Det första commitet lade `.env.example` med riktiga inloggningsuppgifter,
och repot är **offentligt**. Historiken innehåller alltså lösenordet, även
efter att filen rättats i commit `c3d8d49`.

Fixen är att **byta lösenordet** (inte att skriva om historiken):

1. Ändra `BRACCI_PASSWORD` i Render → Environment
2. Save Changes → `ensureAdmin()` uppdaterar hashen automatiskt
3. Logga in med det nya lösenordet

Att skriva om historiken (`git filter-repo` + `push --force`) tar bort
lösenordet från gamla commits, men lösenordsbytet är det som faktiskt
räcker.

---

## 7. Ändringslogg

| Commit | Datum | Vad |
|---|---|---|
| `963ca25` | 19 okt | Första commitet. `.env.example` innehöll riktiga uppgifter (se punkt 2) |
| `37426ce` | 19 okt | README: remote-URL till `nonjo-dev` |
| `c3d8d49` | 19 okt | Riktiga uppgifter borttagna ur `.env.example` |
| `697e6c2` | 19 okt | **Hero**: Braccì-loggan i cirkeln, layout enligt originalsidan. Loggan lades till i serverns allowlist |
| `8652e04` | 19 okt | **Footer** som på originalsidan: mörk bakgrund, logotypbild, guldaccenter, centrerade länkar i mobilvy |
| `3ef807c` | 19 okt | **Navbar**: textloggan "Braccì UF" med guldglans i stället för logobild |
| `ec45ea0` | 19 okt | Lösenordsnoten borttagen från loginsidan |
| `9dd7c51` | 19 okt | Closing-sektionen ("TACK / Till alla som svarade") borttagen |
| `c2910b2` | 19 okt | Text om medarbetarbehörighet under logga in-knappen |
| `4314efc` | 19 okt | Knappen "Se resultatet" borttagen. `img/armband.avif` och dess allowlist-post rensade |
| `7126fdb` | 19 okt | Mellanrummen mellan sektionerna minskade. Celebration-animation lages till |
| `54624ca` | 20 okt | GitHub Action som håller Render-tjänsten vaken + README-avsnitt |
| `b98e49f` | 20 okt | Utvecklingsnoter: arkitektur, ändringslogg, kända problem, testmetoder |
| `b??????` | 20 okt | Stavningskontroll och rättningar. Ny sektion "Vad vi frågar" |

### Rättningar från stavningskontrollen

Stavningskontrollen hittade **inga riktiga stavfel** i sajtens text, men
några andra fel:

- **Faktiskt fel:** den tomma lägesrutan på resultatsidan sa *"Inga svar
  finns sparade i den här webbläsaren ännu."* Svaren ligger på servern,
  inte i webbläsaren. Nu står det *"Inga svar har kommit in ännu."*
- **Språkblandning:** kontaktsektionens rubrik var "GET IN TOUCH" på en
  helt svensk sida. Nu "KONTAKT OSS".
- **Skrivregel:** *"så år ditt svar värt"* → *"så att ditt svar värt"*.
- **Versaler i källkoden:** "BRACCì" → "BRACCIÌ" (CSS `text-transform`
  tog tidigare ut skillnaden visuellt).
- **Nytt ankare:** sektionen "Vad vi frågar" har `id="fragor"`, så den
  går att länka till.

### Ny sektion: "Vad vi frågar"

index.html fick en sektion som förklarar vad de fyra frågorna mäter och
hur svaren används. Rutnätet är fyra kort med tunna linjer emellan —
samma grepp som `.stats` använder. Två kolumner under 900 px, en kolumn
under 640 px.

### Designändringar i korthet

Hero-sektionen följer nu originalsidan: absolutpositionerad grå cirkel
(550 px) med loggan som klipps till cirkel, gungande (`logoFloat`), och en
"upphöjningseffekt" på rubrik och brödtext (tre lager av `text-shadow`).

Navbar-loggan är text ("Bracc" i fet Playfair, "ì" i kursiv, "UF" i guld)
med en glansstripe som sveper över vid hover. Guldglansen använder
`background-clip: text` och ligger i ett `@supports`-block — utan skydden
skulle logotexten bli osynlig, eftersom `color` sätts till `transparent`.

---

## 8. Serverarkitektur

### Routing (`server/server.js`)

`/` och `/index.html` → undersökningen, `/resultat.html` → resultatsidan,
`/api/session`, `/api/login`, `/api/logout`, `/api/svar`,
`/api/svar.csv`, `/api/svar/renstra`.

### Allowlisten — viktig att känna till

`TILLATET` i `server/server.js` bestämmar vilka filer som får laddas
över webben. **En ny fil i `img/` är inte tillgänglig förrän den läggs
där**, annars ger den 404.

```js
"/favicon.svg": "img/favicon.svg",
"/img/logga.png": "img/logga.png",
"/img/logga.webp": "img/logga.webp",
"/img/favicon.svg": "img/favicon.svg"
```

`INNEHALLSTYPER` mappar filändelse till `Content-Type`. Nya bildtyper
måste läggas till där också.

### Autentisering (`server/auth.js`)

- Lösenord hashas med `scrypt` + slumpat salt
- Session: 32 slumpade byte i en HttpOnly-cookie, 12 timmar
- Brute force: max 10 misslyckade försök per IP per 15 min
- `ensureAdmin()` skapar adminkontot vid första start, och uppdaterar det
  om miljövariablerna ändrats

### Databasval (`server/store.js`)

`DATABASE_URL` satt → Postgres, annars SQLite. Båda har identiskt API,
så resten av koden bryr sig inte.

---

## 9. Fällor i koden

**`q4` måste vara en sträng, inte ett tal.** `GILTIGA.q4` i
`server/server.js` är `["1","2","3","4","5"]`, och valideringen gör
`includes(post[nyckel])`. Frontenden skickar `dataset.value`, som alltid är
en sträng — så det funkar. Men ett API-anrop med `q4: 3` (tal) avvisas
med "Svaret är inte komplett." Servern sparar sedan `Number(post.q4)`.

**Fråga 3:s alternativ** använder bindestreck i både HTML och server:
`50-100 kr` och `100-200 kr`. (Live-sidan på GitHub Pages har `&ndash;`,
men det är en annan fil.)

**`[hidden]` har `display: none !important`** i reseten, annars vinner
regler som sätter `display: flex` över webbläsarens `[hidden]`.

**Filer som tas bort ur repot** måste även tas bort ur `TILLATET` och
`INNEHALLSTYPER`, annars blir de döda regler kvar.

---

## 10. Testmetoder

### Skärmbilder med Edge headless

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
& $edge --headless=new --disable-gpu --no-sandbox --hide-scrollbars `
    --user-data-dir="$env:TEMP\edge-profile" `
    --screenshot="$env:TEMP\shot.png" --window-size=1440,900 `
    --virtual-time-budget=4000 "http://localhost:3000/"
```

**Fållor som upptäcktes:**

- **Minsta fönsterbredd är ~500 px.** `--window-size=390` ger en
  layout-viewport på 504 px, och skärmbilden klipps till 390 px. En
  knapp som "saknas" kan bara ligga utanför den synliga delen. Lösning:
  testa med en `iframe` med exakt bredd, t.ex. `<iframe width="390">`.
- **`prefers-reduced-motion` är alltid `reduce` i headless.** Flaggan
  `--force-prefers-reduced-motion` fungerar inte. En egen
  `prefers-reduced-motion`-regel döljer därför element i testbilderna.
  Neutralisera regeln i en kopia av CSS:en om animationen ska synas.
- **Virtual time driver inte CSS-animationer.** Fryser man dem med
  Web Animations API i stället:
  ```js
  document.getAnimations().forEach(function(a) {
      a.pause();
      a.currentTime = 700;   // ms
  });
  ```
  Läs tiden från `location.hash` så samma fil kan användas för flera
  ögonblicksbilder.
- **Skärmbilder av en lång sida** med `--window-size=1440,5000` ger en
  5000 px hög layout, eftersom varje `100vh`-sektion blir 5000 px. Bygg
  hellre en lokal förhandsvisningsfil med bara den del som ska visas.

### Testa API:t

```powershell
# Skriv JSON till fil (PowerShell 5.1:s Set-Content -Encoding UTF8
# lägger till en BOM som JSON.parse inte gillar)
[System.IO.File]::WriteAllText("$env:TEMP\j.json", $json, (New-Object System.Text.UTF8Encoding $false))
curl.exe -X POST http://localhost:3000/api/svar `
    -H "Content-Type: application/json" --data-binary "@$env:TEMP\j.json"
```

Skriv hellre testet i Node — `fetch` finns inbyggt i Node 24, och då slipper
man curl och BOM-problemet.

### End-to-end i webbläsaren

Kopiera projektet till en temp-mapp, lägg till en tillåten route i
`TILLATET` och injicera en drivare i `index.html` som klickar igenom
frågorna. Använd `document.title` för att skicka resultat tillbaka — den
syns i `--dump-dom`.

```js
document.getAnimations().length   // verifiera att animationerna kör
```

### Bra kommandon

```powershell
git log --oneline                       # historik
git status -sb                          # "main...origin/main" = rent
git ls-tree -r --name-only origin/main  # vad som faktiskt finns i repot
git check-ignore -v data/bracci.db      # bekräfta att data/ ignoreras
```

### Stavningskontroll

Det finns ingen svensk ordlista i Windows eller pip-paketen som är
färdiga att använda direkt (`pyspellchecker` saknar svenska). Funkar
istället så här:

1. **Hunspell-ordlista** med affixregler:
   ```
   https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/sv/index.dic
   https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/sv/index.aff
   ```
   Ordlistan innehåller grundord; böjningsformer ("finns", "enkelt",
   "gillar") måste genereras från `.aff`-reglerna. Saknar man det står
   nästan varje vanligt ord som okänt.

2. **Frekvenslista** med de 50 000 vanligaste orden:
   ```
   https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/sv/sv_50k.txt
   ```
   Formatet är `"ord antal"` — ordet står först.

3. **Kombinera de två.** Ett ord godkänns om det finns i någon av dem.
   Då slipper man böjningsformer och sammansättningar som falsklarm,
   samtidigt som riktiga stavfel inte passerar.

4. **Extra filter** i koden: hoppa över ord med bindestreck, acronymer
   och varumärken (`braccì`, `instagram`, `uf` …).

> Teckenklass: använd `[^\W\d_]+` med `re.UNICODE` i stället för en
> explicit lista — annars kapas "Braccì" i "Bracc" + "ì" eftersom
> `ì` inte finns i listan.
>
> **PowerShell 5.1 läser UTF-8-filer som ANSI** och tecknen blir
> trasiga. Gör allt med Python i stället — där är UTF-8 default.

---

## 11. Att gå tillbaka till det här

Det här dokumentet ligger i repot och är alltid tillgängligt. Vid nästa
session: läs `UTVECKLINGS-NOTER.md` först, särskilt avsnitt 6 (kända
problem) och avsnitt 5 (databasen).

**Prioriteringsordning för det som är kvar:**

1. Sätt `DATABASE_URL` mot Neon eller Aiven — annars försvinner svaren
2. Aktivera keep-alive-workflowen under Actions
3. Byt lösenordet i Render → Environment
