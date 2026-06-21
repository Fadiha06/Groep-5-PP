const db = require('../config/db');

class StudentModel {
    static async createProfile(gebruiker_id) {
        const [result] = await db.query('INSERT INTO STUDENT (gebruiker_id) VALUES (?)', [gebruiker_id]);
        return result.insertId;
    }

    // Studentprofiel ophalen via de ingelogde gebruiker (nodig voor dashboard/logboek/evaluaties)
    static async getStudentByGebruikerId(gebruikerId) {
        const [rows] = await db.query('SELECT * FROM STUDENT WHERE gebruiker_id = ?', [gebruikerId]);
        return rows[0];
    }

    // ===== Logboek-feature =====
    static async getStudentMetStage(gebruikerId) {
        const [rows] = await db.query(
            `SELECT s.student_id, st.stage_id, st.startdatum, st.einddatum
            FROM STUDENT s
            JOIN STAGE st ON st.student_id = s.student_id
            WHERE s.gebruiker_id = ?
            ORDER BY st.startdatum DESC LIMIT 1`,
            [gebruikerId]
        );
        return rows[0];
    }

    static async findWeek(stageId, weeknummer) {
        const [rows] = await db.query(
            `SELECT * FROM LOGBOEK_WEEK WHERE stage_id = ? AND weeknummer = ?`,
            [stageId, weeknummer]
        );
        return rows[0];
    }

    static async createWeek(stageId, weeknummer) {
        const [result] = await db.query(
            `INSERT INTO LOGBOEK_WEEK (stage_id, weeknummer, status) VALUES (?, ?, 'open')`,
            [stageId, weeknummer]
        );
        return result.insertId;
    }

    static async findDag(stageId, datum) {
        const [rows] = await db.query(
            `SELECT * FROM LOGBOEK_DAG WHERE stage_id = ? AND datum = ?`,
            [stageId, datum]
        );
        return rows[0];
    }

    static async createDag(weekId, stageId, datum, uren, taken, leerpunten) {
        const [result] = await db.query(
            `INSERT INTO LOGBOEK_DAG
            (week_id, stage_id, datum, uren, taken_beschrijving, leerpunten)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [weekId, stageId, datum, uren, taken, leerpunten]
        );
        return result.insertId;
    }

    static async updateDag(dagId, uren, taken, leerpunten) {
        await db.query(
            `UPDATE LOGBOEK_DAG
            SET uren = ?, taken_beschrijving = ?, leerpunten = ?
            WHERE dag_id = ?`,
            [uren, taken, leerpunten, dagId]
        );
    }

    static async getDagenVanWeek(weekId) {
        const [rows] = await db.query(
            `SELECT dag_id, datum, uren, taken_beschrijving, leerpunten, status
            FROM LOGBOEK_DAG WHERE week_id = ? ORDER BY datum ASC`,
            [weekId]
        );
        return rows;
    }

    static async dienDagIn(dagId) {
        await db.query(
            `UPDATE LOGBOEK_DAG SET status = 'ingediend' WHERE dag_id = ?`,
            [dagId]
        );
    }

    static async dienWeekIn(weekId) {
        await db.query(
            `UPDATE LOGBOEK_WEEK SET status = 'ingediend', ingediend_op = NOW() WHERE week_id = ?`,
            [weekId]
        );
    }

    static async getLaatsteDag(gebruikerId) {
        const [rows] = await db.query(
            `SELECT ld.dag_id, ld.datum, ld.uren, ld.taken_beschrijving, ld.reflectie, ld.leerpunten
            FROM LOGBOEK_DAG ld
            JOIN STAGE st ON st.stage_id = ld.stage_id
            JOIN STUDENT s ON s.student_id = st.student_id
            WHERE s.gebruiker_id = ?
            ORDER BY ld.datum DESC LIMIT 1`,
            [gebruikerId]
        );
        return rows[0];
    }

    static async getStageHeader(gebruikerId) {
        const [rows] = await db.query(
            `SELECT st.stage_id, st.titel, st.startdatum, st.einddatum, b.naam AS bedrijf_naam,
                    CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam,
                    s.opleiding
             FROM STUDENT s
             JOIN STAGE st ON st.student_id = s.student_id
             LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
             LEFT JOIN STAGEMENTOR sm ON st.mentor_id = sm.mentor_id
             LEFT JOIN GEBRUIKER gm ON sm.gebruiker_id = gm.id
             WHERE s.gebruiker_id = ?
             ORDER BY st.startdatum DESC LIMIT 1`,
            [gebruikerId]
        );
        return rows[0];
    }

    static async getAlleCompetenties(opleiding) {
        let comps;
        if (opleiding) {
            [comps] = await db.query(`SELECT competentie_id, naam FROM COMPETENTIE WHERE opleiding = ? ORDER BY naam ASC`, [opleiding]);
        } else {
            [comps] = await db.query(`SELECT competentie_id, naam FROM COMPETENTIE ORDER BY naam ASC`);
        }
        const compIds = comps.map(c => c.competentie_id);
        let niveaus = [];
        if (compIds.length > 0) {
            [niveaus] = await db.query(`SELECT rubriek_id, competentie_id, punten, omschrijving FROM RUBRIEK WHERE competentie_id IN (?) ORDER BY punten ASC`, [compIds]);
        }
        return comps.map(c => ({
            competentie_id: c.competentie_id,
            naam: c.naam,
            niveaus: niveaus.filter(n => n.competentie_id === c.competentie_id)
        }));
    }

    static async getCompetentiesVanDag(dagId) {
        const [rows] = await db.query(
            `SELECT lc.competentie_id, c.naam, lc.score, lc.commentaar
            FROM LOGBOEK_COMPETENTIE lc
            JOIN COMPETENTIE c ON c.competentie_id = lc.competentie_id
            WHERE lc.dag_id = ?`,
            [dagId]
        );
        return rows;
    }

    static async slaCompetentiesOp(dagId, studentId, competenties) {
        await db.query(`DELETE FROM LOGBOEK_COMPETENTIE WHERE dag_id = ?`, [dagId]);
        if (!competenties || competenties.length === 0) return;
        const values = competenties.map(c => [dagId, studentId, c.competentie_id, c.score ?? null, c.commentaar || null]);
        await db.query(
            `INSERT INTO LOGBOEK_COMPETENTIE (dag_id, student_id, competentie_id, score, commentaar) VALUES ?`,
            [values]
        );
    }

    // Compatibiliteitslaag voor oude POST /logboek/dag route
    static async saveLogboekDag(gebruikerId, datum, taken_beschrijving, leerpunten, uren) {
        const info = await StudentModel.getStudentMetStage(gebruikerId);
        if (!info) return null;

        const start = new Date(info.startdatum);
        const dag = new Date(datum);
        const verschil = Math.floor((dag - start) / (1000 * 60 * 60 * 24));
        const weeknummer = Math.floor(verschil / 7) + 1;
        if (weeknummer < 1) throw new Error('Datum valt voor de stage');

        let week = await StudentModel.findWeek(info.stage_id, weeknummer);
        if (week && week.status === 'ingediend') throw new Error('WEEK_INGEDIEND');
        const weekId = week ? week.week_id : await StudentModel.createWeek(info.stage_id, weeknummer);

        const bestaand = await StudentModel.findDag(info.stage_id, datum);
        let dagId, actie;
        if (bestaand) {
            await StudentModel.updateDag(bestaand.dag_id, uren, taken_beschrijving, leerpunten);
            dagId = bestaand.dag_id; actie = 'bijgewerkt';
        } else {
            dagId = await StudentModel.createDag(weekId, info.stage_id, datum, uren, taken_beschrijving, leerpunten);
            actie = 'aangemaakt';
        }
        return { dag_id: dagId, weeknummer, actie };
    }

    static async getGebruiker(gebruikerId) {
        const [rows] = await db.query(`SELECT id, CONCAT(voornaam, ' ', achternaam) AS naam, email, rol FROM GEBRUIKER WHERE id = ?`, [gebruikerId]);
        return rows[0];
    }

    static async getTussentijdseEvaluatie(student_id) {
        const [stages] = await db.query(
            `SELECT stage_id FROM STAGE WHERE student_id = ? ORDER BY stage_id DESC LIMIT 1`,
            [student_id]
        );
        if (!stages.length) return null;
        const { stage_id } = stages[0];

        const [evaluaties] = await db.query(
            `SELECT e.evaluatie_id, e.datum, e.feedback, e.beoordelaar_rol,
                    CONCAT(g.voornaam, ' ', g.achternaam) AS beoordelaar_naam
             FROM EVALUATIE e
             JOIN GEBRUIKER g ON e.beoordelaar_id = g.id
             WHERE e.stage_id = ? AND e.type = 'tussentijds'`,
            [stage_id]
        );

        const [competenties] = await db.query(
            `SELECT ec.score, ec.commentaar,
                    c.naam AS competentie_naam,
                    e.beoordelaar_rol
             FROM EVALUATIE e
             JOIN EVALUATIE_COMPETENTIE ec ON e.evaluatie_id = ec.evaluatie_id
             JOIN COMPETENTIE c ON ec.competentie_id = c.competentie_id
             WHERE e.stage_id = ? AND e.type = 'tussentijds'`,
            [stage_id]
        );

        return { evaluaties, competenties };
    }

    static async getFinaleEvaluatie(student_id) {
        const [stages] = await db.query(
            `SELECT stage_id FROM STAGE WHERE student_id = ? ORDER BY stage_id DESC LIMIT 1`,
            [student_id]
        );
        if (!stages.length) return null;
        const { stage_id } = stages[0];

        const [evaluaties] = await db.query(
            `SELECT e.evaluatie_id, e.datum, e.feedback, e.beoordelaar_rol,
                    CONCAT(g.voornaam, ' ', g.achternaam) AS beoordelaar_naam
             FROM EVALUATIE e
             JOIN GEBRUIKER g ON e.beoordelaar_id = g.id
             WHERE e.stage_id = ? AND e.type = 'finaal'`,
            [stage_id]
        );

        const [competenties] = await db.query(
            `SELECT ec.score, ec.commentaar,
                    c.naam AS competentie_naam,
                    e.beoordelaar_rol
             FROM EVALUATIE e
             JOIN EVALUATIE_COMPETENTIE ec ON e.evaluatie_id = ec.evaluatie_id
             JOIN COMPETENTIE c ON ec.competentie_id = c.competentie_id
             WHERE e.stage_id = ? AND e.type = 'finaal'`,
            [stage_id]
        );

        return { evaluaties, competenties };
    }
    // Haal student op via gebruikerId
    static async getStudentByGebruikerId(gebruikerId) {
        const [rows] = await db.query(
            `SELECT s.student_id, s.studentnummer, s.opleiding,
                    CONCAT(g.voornaam, ' ', g.achternaam) AS naam, g.email
             FROM STUDENT s
             JOIN GEBRUIKER g ON g.id = s.gebruiker_id
             WHERE s.gebruiker_id = ?`,
            [gebruikerId]
        );
        return rows[0] || null;
    }

    // Dashboard statistieken voor student
    static async getDashboardStats(studentId) {
        const [logboekRows] = await db.query(
            `SELECT COUNT(*) AS totaal_weken,
                    SUM(CASE WHEN status = 'ingediend' THEN 1 ELSE 0 END) AS ingediend
             FROM LOGBOEK_WEEK WHERE stage_id IN (SELECT stage_id FROM STAGE WHERE student_id = ?)`,
            [studentId]
        );
        const [urenRows] = await db.query(
            `SELECT COALESCE(SUM(ld.uren), 0) AS totaal_uren
             FROM LOGBOEK_DAG ld
             JOIN STAGE s ON s.stage_id = ld.stage_id
             WHERE s.student_id = ?`,
            [studentId]
        );
        const [instellingenRows] = await db.query(
            `SELECT i.aantal_logboeken
             FROM STUDENT st
             JOIN INSTELLINGEN i ON i.opleiding = st.opleiding
             WHERE st.student_id = ?`,
            [studentId]
        );
        return {
            totaal_weken: logboekRows[0].totaal_weken || 0,
            ingediend: logboekRows[0].ingediend || 0,
            totaal_uren: urenRows[0].totaal_uren || 0,
            aantal_logboeken_verplicht: instellingenRows[0] ? instellingenRows[0].aantal_logboeken : null
        };
    }

    // Stage-procesinfo voor dashboard
    static async getStageproces(studentId) {
        const [rows] = await db.query(
            `SELECT s.stage_id, s.status, s.startdatum, s.einddatum, s.titel, s.goedkeuringsdatum, s.uren_per_week,
                    b.naam AS bedrijfsnaam,
                    c.student_getekend, c.mentor_getekend, c.docent_getekend, c.getekend_op
             FROM STAGE s
             LEFT JOIN BEDRIJF b ON b.bedrijf_id = s.bedrijf_id
             LEFT JOIN CONTRACT c ON c.stage_id = s.stage_id
             WHERE s.student_id = ?
             ORDER BY s.stage_id DESC LIMIT 1`,
            [studentId]
        );
        if (!rows[0]) return null;

        const stage = rows[0];
        const [evaluaties] = await db.query(
            `SELECT type, datum FROM EVALUATIE WHERE stage_id = ?`,
            [stage.stage_id]
        );
        stage.tussentijdse_evaluatie = evaluaties.find(e => e.type === 'tussentijds') || null;
        stage.finale_evaluatie = evaluaties.find(e => e.type === 'finaal') || null;

        return stage;
    }

    // Logboek van huidige week
    static async getLogboekDezeWeek(studentId) {
        const [stages] = await db.query(
            `SELECT stage_id, startdatum FROM STAGE WHERE student_id = ? ORDER BY stage_id DESC LIMIT 1`,
            [studentId]
        );
        if (!stages.length) return null;
        const { stage_id, startdatum } = stages[0];
        const start = new Date(startdatum);
        const nu = new Date();
        const weeknummer = Math.max(1, Math.floor((nu - start) / (1000 * 60 * 60 * 24 * 7)) + 1);
        const [weken] = await db.query(
            `SELECT * FROM LOGBOEK_WEEK WHERE stage_id = ? AND weeknummer = ?`,
            [stage_id, weeknummer]
        );
        if (!weken.length) return null;
        const week = weken[0];
        const [dagen] = await db.query(
            `SELECT dag_id, datum, uren, taken_beschrijving FROM LOGBOEK_DAG WHERE week_id = ? ORDER BY datum ASC`,
            [week.week_id]
        );
        return { ...week, dagen };
    }

    // Notificaties voor gebruiker
    static async getNotificaties(gebruikerId) {
        try {
            const [rows] = await db.query(
                `SELECT notificatie_id, titel, bericht, type FROM NOTIFICATIE WHERE gebruiker_id = ? ORDER BY notificatie_id DESC LIMIT 10`,
                [gebruikerId]
            );
            return rows;
        } catch (e) { return []; }
    }

    // Stage info voor logboek pagina
    static async getLogboekStageInfo(studentId) {
        const [rows] = await db.query(
            `SELECT s.stage_id, s.titel, s.startdatum, s.einddatum,
                    b.naam AS bedrijf_naam
             FROM STAGE s
             LEFT JOIN BEDRIJF b ON b.bedrijf_id = s.bedrijf_id
             WHERE s.student_id = ?
             ORDER BY s.stage_id DESC LIMIT 1`,
            [studentId]
        );
        return rows[0] || null;
    }

    // Laatste logboek dag (op student_id)
    static async getLaatsteLogboekDag(studentId) {
        const [rows] = await db.query(
            `SELECT ld.dag_id, ld.datum, ld.uren, ld.taken_beschrijving, ld.reflectie, ld.leerpunten
             FROM LOGBOEK_DAG ld
             JOIN STAGE s ON s.stage_id = ld.stage_id
             WHERE s.student_id = ?
             ORDER BY ld.datum DESC LIMIT 1`,
            [studentId]
        );
        return rows[0] || null;
    }

}

module.exports = StudentModel;