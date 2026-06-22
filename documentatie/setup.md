## Lokaal opstarten (development)

### Vereisten
- [Node.js](https://nodejs.org/) (LTS)
- Een draaiende **MySQL**-server (bv. XAMPP, WAMP of standalone)

### 1. Repository clonen
```bash
git clone <repo-url>
cd Groep-5-PP
```

### 2. Backend instellen
```bash
cd backend
npm install
```

Maak een `.env`-bestand aan in `backend/` (zie Configuratie) en initialiseer de
database (maakt DB, schema, admin-account en standaard competenties/rubrieken aan):
```bash
npm run db:init
```

Start de API:
```bash
npm start        # of: npm run dev
```
> De API draait op **http://localhost:5000**

### 3. Frontend instellen
```bash
cd ../frontend
npm install
npm run dev
```
> De frontend draait op **http://localhost:5173** en proxyt `/api` automatisch
> naar de backend op poort 5000.

---

## Deployment (schoolserver)

De productie-omgeving draait op een **Linux VM (Ubuntu)** van de hogeschool,
binnen het schoolnetwerk / achter VPN. **Nginx** serveert de frontend en stuurt
API-verkeer door naar de backend; de database draait op **MySQL**.

1. **Code op de VM plaatsen** (clone of pull van de repository).
2. **Database (MySQL)**
   ```bash
   cd backend
   npm install --omit=dev
   npm run db:init          # eenmalig: schema + admin + seed
   ```
3. **Configuratie** — zet een `.env` met de juiste productie-waarden
   (`DB_*`, `JWT_SECRET`, `FRONTEND_URL`, `SMTP_*`).
4. **Backend draaien** — start `node server.js` (aanbevolen via een
   process-manager zoals `pm2` of een `systemd`-service zodat de API blijft draaien).
5. **Frontend builden**
   ```bash
   cd frontend
   npm install
   npm run build            # output in frontend/dist/
   ```
6. **Nginx configureren** — serveer `frontend/dist/` als statische site en stel
   een reverse proxy in zodat `/api` naar de backend (poort 5000) gaat. Voorbeeld:
   ```nginx
   server {
       listen 80;
       server_name ⟨jouw-server-adres⟩;

       root /var/www/stagebeheer/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://localhost:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

> Omdat de VM enkel binnen het schoolnetwerk staat, is de applicatie uitsluitend
> bereikbaar op de campus of via VPN (zie Toegang).

---

## Configuratie

Maak `backend/.env` aan. Variabelen met een fallback-waarde zijn optioneel.

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=stagebeheer

# Server
PORT=5000

# Authenticatie (VERPLICHT — gebruik een lange, willekeurige waarde)
JWT_SECRET=zet-hier-een-geheime-sleutel

# Frontend-URL (gebruikt in e-maillinks)
FRONTEND_URL=http://localhost:5173

# E-mail (optioneel — zonder deze waarden wordt Ethereal test-mail gebruikt)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM="EhB StageTool" <noreply@ehb.be>
```

> `.env` staat in `.gitignore` en mag **nooit** gecommit worden.

---

## Standaard inloggegevens

Na `npm run db:init` is er een admin-account beschikbaar:

| Rol   | E-mail          | Wachtwoord  |
|-------|-----------------|-------------|
| Admin | `admin@ehb.be`  | `admin123`  |

> Wijzig dit wachtwoord meteen in productie.

Andere gebruikers (student, docent, mentor, commissie) maak je aan via het
admin-paneel; zij stellen hun wachtwoord in via de e-maillink.

---

## Rollen

- **student** — stage aanvragen, logboek bijhouden, evaluaties bekijken
- **docent** (leerkracht) — studenten opvolgen, logboeken/feedback, evalueren
- **stagementor** / mentor — logboeken beoordelen, evalueren, contract tekenen
- **stagecommissie** / commissie — stage-aanvragen en contracten goed-/afkeuren
- **admin** / administrator — gebruikers- en competentiebeheer, rapporten

---

## API-overzicht

Alle endpoints zijn geprefixt met `/api`. De meeste vereisen een
`Authorization: Bearer <token>`-header en een specifieke rol.

| Prefix              | Beschrijving                                   |
|---------------------|------------------------------------------------|
| `/api/auth`         | Login, wachtwoord instellen/vergeten, `/me`    |
| `/api/users`        | Gebruikersbeheer (admin)                        |
| `/api/stage`        | Stage-voorstellen indienen & beoordelen         |
| `/api/admin`        | Dashboard, rapporten, contractcontrole          |
| `/api/commissie`    | Goedkeuren/afkeuren door de stagecommissie      |
| `/api/competenties` | Competenties ophalen/aanmaken/bewerken          |
| `/api/contracten`   | Contracten ophalen en (digitaal) ondertekenen   |
| `/api/docent`       | Studentendossiers, logboeken, evaluaties        |
| `/api/evaluatie`    | Evaluatie-concept ophalen en opslaan            |
| `/api/logboek`      | Logboekweken, feedback en goedkeuring           |
| `/api/mentor`       | Logboeken & evaluaties vanuit de mentor         |
| `/api/student`      | Dashboard, logboek, stage-info, evaluaties      |

---

## Database

Het schema (`backend/schema.sql`) is gebaseerd op het ERD in `/documentatie` en
bevat o.a.: `GEBRUIKER`, `STUDENT`, `DOCENT`, `STAGEMENTOR`, `STAGECOMMISSIE`,
`ADMINISTRATIE`, `BEDRIJF`, `STAGE`, `CONTRACT`, `COMPETENTIE`, `RUBRIEK`,
`EVALUATIE` (+ `EVALUATIE_COMPETENTIE`) en de logboektabellen
`LOGBOEK_WEEK` / `LOGBOEK_DAG` / `LOGBOEK_COMPETENTIE`.

Bij het opstarten draait `server.js` een **auto-migratie** die ontbrekende
logboek-/evaluatietabellen en nieuwe kolommen automatisch aanmaakt, zodat
bestaande databases up-to-date blijven.

Handige scripts:
- `npm run db:init` — DB aanmaken + schema + admin + seed (veilig, behoudt data)
- `node init-db.js` — DB **droppen** en volledig opnieuw opbouwen (schone lei)

---
