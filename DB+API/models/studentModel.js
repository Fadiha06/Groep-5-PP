const pool = require('../config/db');

class StudentModel{

static async getStudentByGebruikerId(gebruiker_id) {
    const [rows] = await pool.query(
        `SELECT s.student_id, s.studentnummer, s.opleiding,
                g.naam, g.email,
                st.stage_id, st.startdatum, st.einddatum,
                st.status AS stage_status
         FROM STUDENT s
         JOIN GEBRUIKER g ON s.gebruiker_id = g.id
         LEFT JOIN STAGE st ON st.student_id = s.student_id
         WHERE s.gebruiker_id = ?
         ORDER BY st.stage_id DESC
         LIMIT 1`,
        [gebruiker_id]
    );
    return rows[0] || null;
}

static async getDashboardStats(student_id) {
    const [stages] = await pool.query(
        `SELECT stage_id, startdatum, einddatum
         FROM STAGE WHERE student_id = ?
         ORDER BY stage_id DESC LIMIT 1`,
        [student_id]
    );
    if (!stages.length) return null;

    const { stage_id, startdatum, einddatum } = stages[0];
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalMs = new Date(einddatum) - new Date(startdatum);
    const currentWeekNr = Math.max(1, Math.ceil((new Date() - new Date(startdatum)) / msPerWeek));
    const aantalWeken = Math.ceil(totalMs / msPerWeek);

    const [dagRows] = await pool.query(
        `SELECT COUNT(DISTINCT datum) AS gewerkt FROM LOGBOEK_DAG WHERE stage_id = ?`,
        [stage_id]
    );
    const stagedagenTotaal = Math.round(totalMs / (1000 * 60 * 60 * 24) * 5 / 7);

    const [weekRows] = await pool.query(
        `SELECT COALESCE(SUM(ld.uren), 0) AS uren_ingevoerd
         FROM LOGBOEK_WEEK lw
         LEFT JOIN LOGBOEK_DAG ld ON lw.week_id = ld.week_id
         WHERE lw.stage_id = ? AND lw.weeknummer = ?`,
        [stage_id, currentWeekNr]
    );

    const [logboekRows] = await pool.query(
        `SELECT COUNT(*) AS ingediend
         FROM LOGBOEK_WEEK
         WHERE stage_id = ? AND ingediend_op IS NOT NULL`,
        [stage_id]
    );

    const urenDezeWeek = parseFloat(weekRows[0].uren_ingevoerd);

    return {
        stagedagen: { gewerkt: dagRows[0].gewerkt, totaal: stagedagenTotaal },
        urenDezeWeek: { gewerkt: urenDezeWeek, target: 40, resterend: 40 - urenDezeWeek },
        logboeken: { ingediend: logboekRows[0].ingediend, totaal: aantalWeken },
        huidigWeekNr: currentWeekNr,
        stage_id
    };
}

}
module.exports = StudentModel;