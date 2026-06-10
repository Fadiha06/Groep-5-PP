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

static async getStageproces(student_id) {
    const [stages] = await pool.query(
        `SELECT st.stage_id, st.status, st.goedkeuringsdatum, st.startdatum, st.einddatum,
                c.student_getekend, c.mentor_getekend, c.leerkracht_getekend
         FROM STAGE st
         LEFT JOIN CONTRACT c ON st.stage_id = c.stage_id
         WHERE st.student_id = ?
         ORDER BY st.stage_id DESC LIMIT 1`,
        [student_id]
    );
    if (!stages.length) return null;
    const stage = stages[0];

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekNr = Math.max(1, Math.ceil((new Date() - new Date(stage.startdatum)) / msPerWeek));
    const aantalWeken = Math.ceil((new Date(stage.einddatum) - new Date(stage.startdatum)) / msPerWeek);

    const [evaluaties] = await pool.query(
        `SELECT type FROM EVALUATIE WHERE stage_id = ?`,
        [stage.stage_id]
    );
    const evalTypes = evaluaties.map(e => e.type);

    return [
        {
            stap: 'voorstel_ingediend',
            label: 'Voorstel ingediend',
            voltooid: !!stage.goedkeuringsdatum,
            detail: stage.goedkeuringsdatum
                ? `Goedgekeurd op ${new Date(stage.goedkeuringsdatum).toLocaleDateString('nl-BE')}`
                : 'In behandeling'
        },
        {
            stap: 'contract_opgemaakt',
            label: 'Contract opgemaakt',
            voltooid: !!(stage.student_getekend && stage.mentor_getekend && stage.leerkracht_getekend),
            detail: stage.mentor_getekend ? 'Getekend' : 'Wacht op handtekening mentor'
        },
        {
            stap: 'stage_lopende',
            label: 'Stage lopende',
            voltooid: false,
            actief: true,
            detail: `Week ${weekNr} op ${aantalWeken}`
        },
        {
            stap: 'tussentijdse_evaluatie',
            label: 'Tussentijdse evaluatie',
            voltooid: evalTypes.includes('tussentijds'),
            detail: 'Week 6'
        },
        {
            stap: 'finale_evaluatie',
            label: 'Finale evaluatie',
            voltooid: evalTypes.includes('finaal'),
            detail: 'Na afloop'
        }
    ];
}

static async getLogboekDezeWeek(student_id) {
    const [stages] = await pool.query(
        `SELECT stage_id, startdatum FROM STAGE WHERE student_id = ? ORDER BY stage_id DESC LIMIT 1`,
        [student_id]
    );
    if (!stages.length) return [];

    const { stage_id, startdatum } = stages[0];
    const weekNr = Math.max(1, Math.ceil((new Date() - new Date(startdatum)) / (7 * 24 * 60 * 60 * 1000)));

    const [rows] = await pool.query(
        `SELECT ld.dag_id, ld.datum, ld.uren, ld.taken_beschrijving
         FROM LOGBOEK_WEEK lw
         JOIN LOGBOEK_DAG ld ON lw.week_id = ld.week_id
         WHERE lw.stage_id = ? AND lw.weeknummer = ?
         ORDER BY ld.datum ASC`,
        [stage_id, weekNr]
    );
    return rows;
}

static async getNotificaties(gebruiker_id) {
    const [rows] = await pool.query(
        `SELECT notificatie_id, titel, bericht, type, stage_id
         FROM NOTIFICATIE
         WHERE gebruiker_id = ?
         ORDER BY notificatie_id DESC
         LIMIT 5`,
        [gebruiker_id]
    );
    return rows;
}

}
module.exports = StudentModel;