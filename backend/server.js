const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
// Auto-migratie: maak LOGBOEK tabellen aan als ze ontbreken
const pool = require('./config/db');
async function autoMigreer() {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(`CREATE TABLE IF NOT EXISTS LOGBOEK_WEEK (
            week_id INT AUTO_INCREMENT PRIMARY KEY,
            stage_id INT NOT NULL,
            weeknummer INT NOT NULL,
            ingediend_op DATETIME,
            totaal_uren DECIMAL(5,2),
            status VARCHAR(50) DEFAULT 'open',
            mentor_feedback TEXT,
            FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
        )`);
        await conn.query(`CREATE TABLE IF NOT EXISTS LOGBOEK_DAG (
            dag_id INT AUTO_INCREMENT PRIMARY KEY,
            week_id INT NOT NULL,
            stage_id INT NOT NULL,
            datum DATE NOT NULL,
            uren DECIMAL(5,2),
            taken_beschrijving TEXT,
            reflectie TEXT,
            leerpunten TEXT,
            FOREIGN KEY (week_id) REFERENCES LOGBOEK_WEEK(week_id) ON DELETE CASCADE,
            FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
        )`);
        await conn.query(`CREATE TABLE IF NOT EXISTS LOGBOEK_COMPETENTIE (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dag_id INT NOT NULL,
            student_id INT NOT NULL,
            competentie_id INT NOT NULL,
            score INT,
            commentaar TEXT,
            FOREIGN KEY (dag_id) REFERENCES LOGBOEK_DAG(dag_id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
            FOREIGN KEY (competentie_id) REFERENCES COMPETENTIE(competentie_id) ON DELETE CASCADE
        )`);
        await conn.query(`CREATE TABLE IF NOT EXISTS EVALUATIE (
            evaluatie_id INT AUTO_INCREMENT PRIMARY KEY,
            stage_id INT NOT NULL,
            beoordelaar_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            datum DATE,
            feedback TEXT,
            beoordelaar_rol VARCHAR(50),
            FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE,
            FOREIGN KEY (beoordelaar_id) REFERENCES GEBRUIKER(id) ON DELETE CASCADE
        )`);
        await conn.query(`CREATE TABLE IF NOT EXISTS EVALUATIE_COMPETENTIE (
            id INT AUTO_INCREMENT PRIMARY KEY,
            evaluatie_id INT NOT NULL,
            competentie_id INT NOT NULL,
            score INT,
            commentaar TEXT,
            FOREIGN KEY (evaluatie_id) REFERENCES EVALUATIE(evaluatie_id) ON DELETE CASCADE,
            FOREIGN KEY (competentie_id) REFERENCES COMPETENTIE(competentie_id) ON DELETE CASCADE
        )`);
        // Seed RUBRIEK als leeg
        const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM RUBRIEK');
        if (n === 0) {
            const [comps] = await conn.query('SELECT competentie_id FROM COMPETENTIE');
            if (comps.length > 0) {
                const rijen = [];
                for (const c of comps) {
                    rijen.push(
                        [c.competentie_id, 1, 'De student toont dit zelden of nauwelijks aan.'],
                        [c.competentie_id, 2, 'De student toont dit met begeleiding aan.'],
                        [c.competentie_id, 3, 'De student toont dit zelfstandig aan.'],
                        [c.competentie_id, 4, 'De student toont dit uitstekend en proactief aan.'],
                        [c.competentie_id, 5, 'De student overtreft de verwachtingen en coacht anderen.']
                    );
                }
                await conn.query('INSERT INTO RUBRIEK (competentie_id, punten, omschrijving) VALUES ?', [rijen]);
                console.log('  RUBRIEK: ' + rijen.length + ' niveaus aangemaakt');
            }
        }
        // ── Migratie: score kolom op LOGBOEK_COMPETENTIE ──
        const [lcCols] = await conn.query(`SHOW COLUMNS FROM LOGBOEK_COMPETENTIE LIKE 'score'`);
        if (lcCols.length === 0) {
            await conn.query(`ALTER TABLE LOGBOEK_COMPETENTIE ADD COLUMN score INT AFTER competentie_id`);
            await conn.query(`ALTER TABLE LOGBOEK_COMPETENTIE ADD COLUMN commentaar TEXT AFTER score`);
            console.log('  LOGBOEK_COMPETENTIE: score + commentaar kolommen toegevoegd');
        }
        // ── Migratie: nieuwe kolommen op LOGBOEK_WEEK ──
        const [lwCols] = await conn.query(`SHOW COLUMNS FROM LOGBOEK_WEEK LIKE 'docent_feedback'`);
        if (lwCols.length === 0) {
            await conn.query(`ALTER TABLE LOGBOEK_WEEK ADD COLUMN docent_feedback TEXT AFTER mentor_feedback`);
            await conn.query(`ALTER TABLE LOGBOEK_WEEK ADD COLUMN docent_goedgekeurd BOOLEAN DEFAULT FALSE AFTER docent_feedback`);
            console.log('  LOGBOEK_WEEK: docent_feedback + docent_goedgekeurd kolommen toegevoegd');
        }
        // ── Migratie: EVALUATIE.type van ENUM naar VARCHAR(50) ──
        const [evType] = await conn.query(`SHOW COLUMNS FROM EVALUATIE LIKE 'type'`);
        if (evType.length > 0 && evType[0].Type && evType[0].Type.includes('enum')) {
            await conn.query(`ALTER TABLE EVALUATIE MODIFY COLUMN type VARCHAR(50) NOT NULL`);
            console.log('  EVALUATIE: type kolom aangepast van ENUM naar VARCHAR(50)');
        }
        // ── Migratie: fix stages zonder mentor_id/leerkracht_id ──
        const [fixStages] = await conn.query(`
            SELECT s.stage_id, s.bedrijf_id, b.email AS mentor_email
            FROM STAGE s
            JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE s.status = 'goedgekeurd' AND s.mentor_id IS NULL
        `);
        if (fixStages.length > 0) {
            console.log(`[auto-migratie] ${fixStages.length} goedgekeurde stages zonder mentor_id - bezig met fixen...`);
            for (const stage of fixStages) {
                if (!stage.mentor_email) continue;
                let [bestaand] = await conn.query('SELECT id FROM GEBRUIKER WHERE email = ?', [stage.mentor_email]);
                let mentorGebruikerId;
                if (bestaand.length > 0) {
                    mentorGebruikerId = bestaand[0].id;
                } else {
                    const crypto = require('crypto');
                    const argon2 = require('argon2');
                    const randomPwd = crypto.randomBytes(16).toString('hex');
                    const hash = await argon2.hash(randomPwd);
                    const voornaam = stage.mentor_email.split('@')[0];
                    const [nieuw] = await conn.query(
                        'INSERT INTO GEBRUIKER (voornaam, achternaam, email, wachtwoord, rol) VALUES (?, ?, ?, ?, ?)',
                        [voornaam, '', stage.mentor_email, hash, 'stagementor']
                    );
                    mentorGebruikerId = nieuw.insertId;
                }
                let [mentorRecord] = await conn.query('SELECT mentor_id FROM STAGEMENTOR WHERE gebruiker_id = ?', [mentorGebruikerId]);
                let mentorId;
                if (mentorRecord.length > 0) {
                    mentorId = mentorRecord[0].mentor_id;
                } else {
                    const [nieuweMentor] = await conn.query(
                        'INSERT INTO STAGEMENTOR (gebruiker_id, bedrijf_id) VALUES (?, ?)',
                        [mentorGebruikerId, stage.bedrijf_id]
                    );
                    mentorId = nieuweMentor.insertId;
                }
                await conn.query('UPDATE STAGE SET mentor_id = ? WHERE stage_id = ?', [mentorId, stage.stage_id]);
            }
            console.log(`[auto-migratie] ${fixStages.length} stages gefixed met mentor_id`);
        }
        console.log('[auto-migratie] Logboek tabellen OK');
    } catch (err) {
        console.error('[auto-migratie] FOUT:', err.message);
    } finally {
        if (conn) conn.release();
    }
}



const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic Route
app.get('/', (req, res) => {
    res.send('Stagebeheer API is running...');
});

// Import Routes
const authRoutes       = require('./routes/authRoutes');
const userRoutes       = require('./routes/userRoutes');
const stageRoutes      = require('./routes/stageRoutes');
const adminRoutes      = require('./routes/adminRoutes');
const commissieRoutes  = require('./routes/commissieRoutes');
const competentieRoutes = require('./routes/competentieRoutes');
const contractRoutes   = require('./routes/contractRoutes');
const docentRoutes     = require('./routes/docentRoutes');
const evaluatieRoutes  = require('./routes/evaluatieRoutes');
const logboekRoutes    = require('./routes/logboekRoutes');
const mentorRoutes     = require('./routes/mentorRoutes');
const studentRoutes    = require('./routes/studentRoutes');

app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/stage',        stageRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/commissie',    commissieRoutes);
app.use('/api/competenties', competentieRoutes);
app.use('/api/contracten',   contractRoutes);
app.use('/api/docent',       docentRoutes);
app.use('/api/evaluatie',    evaluatieRoutes);
app.use('/api/logboek',      logboekRoutes);
app.use('/api/mentor',       mentorRoutes);
app.use('/api/student',      studentRoutes);

// Start Server
autoMigreer();

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});