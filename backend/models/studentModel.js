const db = require('../config/db');

class StudentModel {
    static async createProfile(gebruiker_id) {
        const [result] = await db.query('INSERT INTO STUDENT (gebruiker_id) VALUES (?)', [gebruiker_id]);
        return result.insertId;
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

    static async createDag(weekId, stageId, datum, uren, taken, reflectie, leerpunten) {
        const [result] = await db.query(
            `INSERT INTO LOGBOEK_DAG
            (week_id, stage_id, datum, uren, taken_beschrijving, reflectie, leerpunten)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [weekId, stageId, datum, uren, taken, reflectie, leerpunten]
        );
        return result.insertId;
    }

    static async updateDag(dagId, uren, taken, reflectie, leerpunten) {
        await db.query(
            `UPDATE LOGBOEK_DAG
            SET uren = ?, taken_beschrijving = ?, reflectie = ?, leerpunten = ?
            WHERE dag_id = ?`,
            [uren, taken, reflectie, leerpunten, dagId]
        );
    }

    static async getDagenVanWeek(weekId) {
        const [rows] = await db.query(
            `SELECT dag_id, datum, uren, taken_beschrijving, reflectie, leerpunten
            FROM LOGBOEK_DAG WHERE week_id = ? ORDER BY datum ASC`,
            [weekId]
        );
        return rows;
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
            `SELECT st.titel, st.startdatum, st.einddatum, b.naam AS bedrijf_naam
            FROM STUDENT s
            JOIN STAGE st ON st.student_id = s.student_id
            LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
            WHERE s.gebruiker_id = ?
            ORDER BY st.startdatum DESC LIMIT 1`,
            [gebruikerId]
        );
        return rows[0];
    }

    static async getAlleCompetenties() {
        const [comps] = await db.query(`SELECT competentie_id, naam FROM COMPETENTIE ORDER BY naam ASC`);
        const [niveaus] = await db.query(`SELECT rubriek_id, competentie_id, punten, omschrijving FROM RUBRIEK ORDER BY punten ASC`);
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

    static async getGebruiker(gebruikerId) {
        const [rows] = await db.query(`SELECT id, naam, email, rol FROM GEBRUIKER WHERE id = ?`, [gebruikerId]);
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
                    g.naam AS beoordelaar_naam
             FROM EVALUATIE e
             JOIN GEBRUIKER g ON e.beoordelaar_id = g.id
             WHERE e.stage_id = ? AND e.type = 'tussentijds'`,
            [stage_id]
        );

        const [competenties] = await db.query(
            `SELECT ec.score, ec.commentaar,
                    c.naam AS competentie_naam
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
                    g.naam AS beoordelaar_naam
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
}

module.exports = StudentModel;
