# Braccì UF – Marknadsundersökning

En fyrafrågig marknadsundersökning i samma visuella stil som bracci-sidan.
Svaren sparas på en server och resultatet är skyddat med inloggning.

## Frågorna

| # | Fråga | Svar |
|---|-------|------|
| 1 | Skulle du kunna tänka dig att köpa ett armband från oss? | Ja / Nej / Kanske |
| 2 | Vilken typ av armband gillar du mest? | Enkelt och stilrent / Färgglatt / Lyxigt / Street |
| 3 | Hur mycket skulle du kunna tänka dig att betala för ett armband? | Under 50 / 50–100 / 100–200 / Över 200 kr |
| 4 | Hur viktigt är designen när du köper ett armband? | 1–5 |

Fråga 1–3 visas i en meny där man klickar fram. Fråga 4 är en 1–5-skala.

### Vad varje fråga mäter

| # | Mäter | Så används svaret |
|---|-------|--------------------|
| 1 | **Köplust** | Om det finns intresse över huvud taget. Antalet "Ja" visas som "Vill köpa" i procent, och diagrammet visar alla tre alternativen (Ja / Nej / Kanske). |
| 2 | **Stil** | Vilken riktning nästa kollektion ska utvecklas i. Det vanligaste svaret visas som "mest populära stilen". |
| 3 | **Pris** | Vad som känns rimligt. Medelvärdet av svaren ger "snittpriset" på resultatsidan, så att vi kan placera armbanden rätt. |
| 4 | **Design** | Hur mycket vi kan investera i detaljerna. Medelvärdet visas som "Design (snitt)" — en låg siffra betyder att hantverket väger tyngre än designen. |

Snittpriset räknas fram med mitten av varje prisintervall (40, 75, 150
och 250 kr), eftersom svaren är intervall och inte exakta belopp. Det
gör värdet till en uppskattning, inte en faktisk medelprisering.

### Så hanteras svaren

- **Anonymt.** Inga namn, inga mailadresser, inga IP-adresser sparas
  tillsammans med svaret. Formuläret skickar bara de fyra svaren.
- **Aggregerat.** Resultatsidan visar antal svar, andelar, medelvärden och
  stapeldiagram — aldrig enskilda svar.
- **Skyddat.** `/api/svar`, `/api/svar.csv` och `/api/svar/renstra` kräver
  en giltig session. Resultatsidan är alltså bara tillgänglig för Braccìs
  medarbetare.
- **Inga kakor för besökaren.** En svarsession lagras inte i webbläsaren,
  bara en kortlivad inloggningscookie för medarbetarna.

---

## Kom igång

### 1. Sätt din e-post och ditt lösenord

Kopiera `.env.example` till `.env` och fyll i dina egna uppgifter:

```
BRACCI_EMAIL=din-mail@exempel.se
BRACCI_PASSWORD=ditt-losenord
```

### 2. Starta servern

```powershell
npm start
```

Servern svarar nu på **http://localhost:3000**.

> Det finns **inget att installera**. Databasen är den inbyggda SQLite som
> ingår i Node, så du behöver inte `npm install` någonsin. Kräver Node 23.4
> eller senare.

### 3. Öppna sidorna

| | |
|---|---|
| Undersökningen | http://localhost:3000/ |
| Resultat (kräver inloggning) | http://localhost:3000/resultat.html |

> Öppna alltid via `http://localhost:3000`. Dubbelklickar du på
> `index.html` finns ingen server att skicka svar till.

### Glömt lösenordet?

Radera `data/bracci.db` och starta om servern. Ett nytt lösenord skapas
och skrivs ut i terminalen.

---

## Dela undersökningen

Kör `npm start` på en dator som är igång hela tiden, eller ladda upp
projektet till en värd som stödjer Node, till exempel
[Render](https://render.com) eller [Railway](https://railway.app).

> GitHub Pages fungerar **inte** här, eftersom sidan behöver en server för
> att ta emot svar och skydda resultaten.

För att komma åt sidan från mobilen eller från en annan dator i samma
nätverk, använd datorns lokala IP-adress i stället för `localhost`, till
exempel `http://192.168.1.5:3000`. Du hittar IP-adressen genom att köra
`ipconfig` och leta efter IPv4-adress.

---

## Så är det skyddat

| | |
|---|---|
| Lösenord | Hashas med **scrypt** och ett slumpat salt. Lagras aldrig i klartext. |
| Inloggning | Jämförs tidssäkert, så svarstiden avslöjar inte om e-posten finns. |
| Session | 32 slumpade byte i en `HttpOnly`-cookie som JavaScript inte kan läsa. |
| Skyddade APIs | `/api/svar`, `/api/svar.csv` och `/api/svar/renstra` kräver giltig session. |
| Brute force | Max 10 misslyckade försök per IP och 15 minuter. |
| Filer | En lista med tillåtna filer. Databasen, `.env` och serverkoden går inte att nå över webben. |

---

## Resultatsidan

På `resultat.html` får du efter inloggning:

- **Snabbstatistik** – antal svar, andel som vill köpa, mest populära
  stilen, snittpris och snittbetyg för designen.
- **Stapeldiagram** för alla fyra frågorna, i procent och antal.
- **Ladda ner CSV** (semikolon + BOM, öppnas direkt i Excel).
- **Ladda ner JSON** om du vill bearbeta svaren vidare.
- **Kopiera länk** för att dela undersökningen.
- **Rensa alla svar** om du vill börja om.

---

## Välja databas

Servern väljer databas automatiskt utifrån en enda inställning,
`DATABASE_URL`:

| Situation | `DATABASE_URL` | Vad som händer |
|---|---|---|
| Lokalt, `npm start` | Saknas | SQLite i `data/bracci.db` |
| Render eller molnet | Satt | Postgres via anslutningsadressen |

Båda vägarna har identiskt beteende, så undersökningen och
resultatsidan är densamma oavsett. Bytet sker alltså utan att
du behöver röra någon kod.

### Så sätter du upp Postgres

1. Skapa ett konto och en gratis-databas på **Neon**
   ([neon.tech](https://neon.tech)) eller **Aiven**
   ([aiven.io](https://aiven.io)). Båda har fria planer utan
   tidsgräns, till skillnad från Renders egen databas som
   raderas efter 30 dagar.

2. Kopiera den adress du får. Den ser ut så här:

   ```
   postgres:// anvandare:losenord@host.databas.neon.tech:5432/databas?sslmode=require
   ```

3. I Render: **Environment** → **Add Environment Variable**,
   namn `DATABASE_URL`, klistra in adressen.

   Eller markera rader `BRACCI_EMAIL` och `BRACCI_PASSWORD`
   i `render.yaml`, ta bort `#` framför `DATABASE_URL` och
   sätt `sync: false`.

Servern skapar tabellerna själv första gången den startar.
Inga migrations att köra.

### Lokalt med Postgres

Vill du testa Postgres-läget hemma utan molntjänst:

```powershell
$env:DATABASE_URL="postgres://postgres:postgres@localhost:5432/bracci"
npm start
```

---

## Publicera på Render

### Viktigt varning först

Render raderar **alla filer på serverns disk** varje gång tjänsten startas
om, går i vila eller deployas. Det gäller även den fria webbtjänsten, som
dessutom inte tillåter någon beständig disk.

Lokalt ligger databasen i `data/bracci.db`, alltså på just den disken.
**Publicerar du utan att sätta `DATABASE_URL` förlorar du alla svar**,
och du märker det först när du tittar på resultatet igen.

Lösningen är att peka servern på en Postgres, se **Välja databas**
ovanför. Servern skriver ut en tydlig varning i loggen om du glömmer.

### Steg för steg

1. **Lägg upp koden på GitHub.** Skapa ett nytt, tomt repo och pusha
   mappen. `.env` och `data/` finns redan i `.gitignore`, så varken dina
   uppgifter eller svar laddas upp.

   ```powershell
   cd bracci-marknadsundersokning
   git init
   git add .
   git commit -m "Marknadsundersokning Bracci"
   git branch -M main
   git remote add origin https://github.com/nonjo-dev/bracci-undersokning.git
   git push -u origin main
   ```

2. **Skapa en gratis Postgres** på Neon eller Aiven, enligt
   **Välja databas** ovan. Kopiera anslutningsadressen.

3. **Skapa tjänsten på Render.** Logga in på
   [render.com](https://render.com), välj **New → Blueprint**, peka på
   repot och välj `.github`-mappen. Render läser `render.yaml` och fyller i
   resten.

4. **Fyll i dina uppgifter.** Render frågar efter `BRACCI_EMAIL`,
   `BRACCI_PASSWORD` och `DATABASE_URL`. Hemligheterna sparas i tjänstens
   miljövariabler och hamnar inte i koden.

5. **Klart.** Du får en adress som ser ut så här:
   `https://bracci-undersokning.onrender.com`

### Om du hellre gör det manuellt

Välj **New → Web Service** i stället, och fyll i:

| Fält | Värde |
|------|-------|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Node version | 24 (finns i `.node-version`) |

Lägg till `BRACCI_EMAIL`, `BRACCI_PASSWORD` och `DATABASE_URL` under
**Environment**.

> Byten tar några minuter. Sidan sover dessutom i 15 minuter när ingen
> besöker den, och den första besökaren får vänta ungefär en minut på
> uppstart.

### Kan du ansluta databasen med ett klick?

I Render kan du skapa en Postgres och låta den kopplas ihop
automatiskt. Välj **New → Postgres**, och när du skapar tjänsten
bocka i **Connect** under databasen. Då sätter Render `DATABASE_URL`
för dig.

Men Render egna gratisdatabas raderas efter 30 dagar, så det lämpar sig
bara om undersökningen ska vara igång kortare än så. Annars är Neon
eller Aiven bättre.

### Sidan sover efter 15 minuter

Render free-planens webbtjänster somnar efter 15 minuter utan
inkommande trafik. Nästa besökare får då vänta upp till en minut
medan servern startar, eftersom Render visar en laddningssida under
uppstarten.

Det finns ett färdigt stöd för det i repot:
`.github/workflows/keep-render-awake.yml`. Det är en GitHub Action
som skickar ett anrop till `/api/session` var 14:e minut, vilket
räknas som trafik så att tjänsten aldrig somnar.

Workflow-filen är redan i repot. Du behöver bara se till att den
körs:

1. Öppna repot på GitHub och gå till fliken **Actions**
2. Välj **Håll Render vaken** i listan till vänster
3. Klicka **Run workflow** och välj **Run workflow** igen

Därefter körs den automatiskt vid varje push och vid varje
schemalagd tidpunkt. Du kan också köra den manuellt när du vill.

> **Om schemat inte verkar köra:** GitHub hoppar ibland över
> schemalagda körningar, särskilt vid :00 och :30. Därför kör
> workflown vid udda minuter (07, 21, 35, 49). Om den fortfarande
> inte kickar igång, använd UptimeRobot nedan — det är det
> säkraste alternativet.

### Säkraste alternativet: UptimeRobot

[UptimeRobot](https://uptimerobot.com) har en gratis plan som
kontrollerar en adress var femte minut. Det är byggt just för
det här och är betydligt mer tillförlitligt än GitHub's
schemaläggning.

1. Skapa ett konto på uptimerobot.com
2. **Add New Monitor** → typ **HTTP(s)**
3. Friendly name: `bracci-undersokning`
4. URL: `https://bracci-undersokning.onrender.com/api/session`
5. Monitoring interval: **5 minutes**
6. **Create Monitor**

Du behöver inte betala för något. Kontrollen träffar `/api/session`
eftersom den route:en inte rör databasen när ingen cookie skickas
med — den är alltså nästan gratis i resurser.

### Vill du inte ha något av det här?

Köp en betald plan på Render (7 $/månad). Då är tjänsten alltid igång,
du slipper laddningssidan och kan ta bort både workflow-filen och
UptimeRobot-kontrollen.

> **Obs:** det här löser bara väntetiden. Svaren överlever bara om
> `DATABASE_URL` är satt – annars ligger databasen på Render's
> ephemera disk och försvinner varje gång servern startar om.

---

## Filer

```
index.html          Själva undersökningen
resultat.html       Inloggning + resultat med diagram
style.css           All design
survey.js           Logiken för undersökningen
results.js          Inloggning, statistik och diagram

render.yaml         Inställningarna för Render
.node-version       Node 24

server/
  server.js         HTTP-server, routing och filservering
  store.js          Väljer databas utifrån DATABASE_URL
  sqlite-store.js   Lokal lagring, ingen installation
  postgres-store.js LAGRing på Render
  auth.js           Lösenordshashning, sessioner och spärr mot försök

data/               Skapas automatiskt. Innehåller SQLite-filen.
.env                Dina uppgifter. Skapas av dig. Laddas aldrig upp.
```

---

## Anpassa

**Färger och typografi** finns högst upp i `style.css`:

```css
body {
    background: #f5f4f0;   /* varm off-white */
    color: #111;
}

.section-label { color: #777; }
.bar-track     { background: #e3e0d8; }
```

**Frågorna** ligger i `index.html` inuti `<fieldset class="question">`.
Glöm inte att:

1. lägga till motsvarande etikett i `results.js` (`FRAGA_1` till `FRAGA_4`)
2. godkänna det nya alternativet i `GILTIGA` högst upp i `server/server.js`

Punkt 2 är viktig, annars avvisar servern svaret med ett felmeddelande.

---

## Säkerhetsnot

- Kör alltid via `https://` när sidan ligger på internet. över `http://`
  skickas lösenordet i klartext.
- Lägg alltid `.env` och `data/` i `.gitignore` (redan gjort).
- Byt lösenord om du tror att någon kommit åt dina uppgifter.