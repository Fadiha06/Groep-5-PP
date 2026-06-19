const pool = require('../config/db');

// Haal docent + naam op via de ingelogde gebruiker
const getDocent = async (gebruikerId) => {
    const [rows] = await pool.query(
        `SELECT d.docent_id, g.naam
        FROM DOCENT d
        JOIN GEBRUIKER g ON g.id = d.gebruiker_id
        WHERE d.gebruiker_id = ?`,
        [gebruikerId]
    );
    return rows[0];
};

// Alle studenten van deze docent + hun logboekstatus + opgetelde uren voor een week
const getStudentenMetLogboekStatus = async (docentId, weeknummer) => {
    const [rows] = await pool.query(
        `SELECT
            st.stage_id,
            g.naam AS student_naam,
            b.naam AS bedrijf_naam,
            lw.status AS logboek_status,
            (SELECT COALESCE(SUM(ld.uren), 0)
                FROM LOGBOEK_DAG ld
                WHERE ld.week_id = lw.week_id) AS totaal_uren
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        LEFT JOIN LOGBOEK_WEEK lw ON lw.stage_id = st.stage_id AND lw.weeknummer = ?
        WHERE st.leerkracht_id = ?`,
        [weeknummer, docentId]
    );
    return rows;
};

// Stage-info: student (gebruiker_id) + leerkracht — voor de reminder
const getStageInfo = async (stageId) => {
    const [rows] = await pool.query(
        `SELECT st.stage_id, st.leerkracht_id, s.gebruiker_id AS student_gebruiker_id, g.naam AS student_naam
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        WHERE st.stage_id = ?`,
        [stageId]
    );
    return rows[0];
};

// Maak een notificatie aan voor een gebruiker
const maakNotificatie = async (gebruikerId, stageId, titel, bericht, type) => {
    const [result] = await pool.query(
        `INSERT INTO NOTIFICATIE (gebruiker_id, stage_id, titel, bericht, type)
        VALUES (?, ?, ?, ?, ?)`,
        [gebruikerId, stageId, titel, bericht, type]
    );
    return result.insertId;
};

// Contract-status per student van deze docent
const getMilestones = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT
            st.stage_id,
            g.naam AS student_naam,
            c.student_getekend,
            c.mentor_getekend
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN CONTRACT c ON c.stage_id = st.stage_id
        WHERE st.leerkracht_id = ?`,
        [docentId]
    );
    return rows;
};

// Volledige dossiers van de studenten van deze docent
const getDossiers = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT
            st.stage_id,
            s.gebruiker_id,
            g.naam AS student_naam,
            s.studentnummer,
            s.opleiding,
            s.telefoonnummer AS student_telefoon,
            g.email,
            b.naam AS bedrijf_naam,
            b.adres AS bedrijf_adres,
            b.stad AS bedrijf_stad,
            b.telefoon AS bedrijf_telefoon,
            mg.naam AS mentor_naam,
            sm.telefoonnummer AS mentor_telefoon
            , st.startdatum
            , st.einddatum
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        LEFT JOIN STAGEMENTOR sm ON sm.bedrijf_id = st.bedrijf_id
        LEFT JOIN GEBRUIKER mg ON mg.id = sm.gebruiker_id
        WHERE st.leerkracht_id = ?`,
        [docentId]
    );
    return rows;
};

// Meldingen/notificaties van een student
const getMeldingenVoorStudent = async (gebruikerId) => {
    const [rows] = await pool.query(
        `SELECT notificatie_id, titel, bericht, type
        FROM NOTIFICATIE
        WHERE gebruiker_id = ?
        ORDER BY notificatie_id DESC`,
        [gebruikerId]
    );
    return rows;
};

// Alle logboekweken van de studenten van deze docent, met dagen + competenties
const getLogboekenVoorDocent = async (docentId) => {
    const [weken] = await pool.query(
        `SELECT
            lw.week_id, lw.stage_id, lw.weeknummer AS week, lw.status,
            DATE_FORMAT(lw.ingediend_op, '%d/%m/%Y') AS datum,
            g.naam AS naam, s.opleiding AS opleiding,
            b.naam AS bedrijf,
            CONCAT(DATE_FORMAT(st.startdatum, '%d/%m/%Y'), ' – ', DATE_FORMAT(st.einddatum, '%d/%m/%Y')) AS periode
        FROM LOGBOEK_WEEK lw
        JOIN STAGE st ON st.stage_id = lw.stage_id
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        WHERE st.leerkracht_id = ?
        ORDER BY lw.stage_id, lw.weeknummer`,
        [docentId]
    );

    for (const w of weken) {
        const [dagen] = await pool.query(
            `SELECT
                DATE_FORMAT(ld.datum, '%d/%m/%Y') AS datum,
                ld.uren,
                ld.taken_beschrijving AS taken,
                ld.reflectie,
                ld.leerpunten AS problemen,
                ld.dag_id
            FROM LOGBOEK_DAG ld
            WHERE ld.week_id = ?
            ORDER BY ld.datum`,
            [w.week_id]
        );
        for (const d of dagen) {
            const [comps] = await pool.query(
                `SELECT c.naam
                 FROM LOGBOEK_COMPETENTIE lc
                 JOIN COMPETENTIE c ON c.competentie_id = lc.competentie_id
                 WHERE lc.dag_id = ?`,
                [d.dag_id]
            );
            d.competenties = comps.map(c => c.naam);
        }
        w.dagen = dagen;
    }
    return weken;
};

// Veiligheidscheck: hoort deze stage bij deze docent?
const isEigenStage = async (docentId, stageId) => {
    const [rows] = await pool.query(
        'SELECT 1 FROM STAGE WHERE stage_id = ? AND leerkracht_id = ?',
        [stageId, docentId]
    );
    return rows.length > 0;
};

const keurLogboekWeekGoed = async (stageId, week) => {
    await pool.query(
        "UPDATE LOGBOEK_WEEK SET status = 'goedgekeurd' WHERE stage_id = ? AND weeknummer = ?",
        [stageId, week]
    );
};

const geefLogboekWeekFeedback = async (stageId, week, feedback) => {
    await pool.query(
        "UPDATE LOGBOEK_WEEK SET mentor_feedback = ?, status = 'feedback' WHERE stage_id = ? AND weeknummer = ?",
        [feedback, stageId, week]
    );
};

// Actieve (lopende) stages van deze docent + status van de logboekweek van NU
const getActieveStagesMetLogboek = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT
            st.stage_id,
            g.naam AS student_naam,
            b.naam AS bedrijf_naam,
            GREATEST(1, FLOOR(DATEDIFF(CURDATE(), st.startdatum) / 7) + 1) AS huidige_week,
            lw.status AS logboek_status,
            (SELECT COALESCE(SUM(ld.uren), 0) FROM LOGBOEK_DAG ld WHERE ld.week_id = lw.week_id) AS totaal_uren
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        LEFT JOIN LOGBOEK_WEEK lw
            ON lw.stage_id = st.stage_id
            AND lw.weeknummer = GREATEST(1, FLOOR(DATEDIFF(CURDATE(), st.startdatum) / 7) + 1)
        WHERE st.leerkracht_id = ?
            AND st.status <> 'afgerond'
            AND st.startdatum <= CURDATE()
            AND (st.einddatum IS NULL OR st.einddatum >= CURDATE())`,
        [docentId]
    );
    return rows;
};

// Todo's voor de docent: nog te tekenen contracten + net ingediende logboeken
const getTodos = async (docentId) => {
    const [contracten] = await pool.query(
        `SELECT g.naam AS student
         FROM CONTRACT c
         JOIN STAGE st ON st.stage_id = c.stage_id
         JOIN STUDENT s ON s.student_id = st.student_id
         JOIN GEBRUIKER g ON g.id = s.gebruiker_id
         WHERE st.leerkracht_id = ?
           AND (c.docent_getekend = 0 OR c.docent_getekend IS NULL)`,
        [docentId]
    );

    const [evaluaties] = await pool.query(
        `SELECT g.naam AS student
         FROM STAGE st
         JOIN STUDENT s ON s.student_id = st.student_id
         JOIN GEBRUIKER g ON g.id = s.gebruiker_id
         JOIN DOCENT d ON d.docent_id = st.leerkracht_id
         WHERE st.leerkracht_id = ?
           AND st.status <> 'afgerond'
           AND st.startdatum <= CURDATE()
           AND (st.einddatum IS NULL OR st.einddatum >= CURDATE())
           AND NOT EXISTS (
               SELECT 1 FROM EVALUATIE e
               WHERE e.stage_id = st.stage_id
                 AND e.type = 'tussentijds'
                 AND e.beoordelaar_id = d.gebruiker_id
           )`,
        [docentId]
    );

    return { contracten, evaluaties };
};

// Gemiddelde competentie-score per student (uit de evaluaties)
const getPuntenAggregatie = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT g.naam AS student,
                ROUND(AVG(ec.score), 1) AS gemiddelde,
                COUNT(DISTINCT ec.competentie_id) AS aantal_competenties
         FROM EVALUATIE e
         JOIN STAGE st ON st.stage_id = e.stage_id
         JOIN STUDENT s ON s.student_id = st.student_id
         JOIN GEBRUIKER g ON g.id = s.gebruiker_id
         JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
         WHERE st.leerkracht_id = ?
         GROUP BY s.student_id, g.naam`,
        [docentId]
    );
    return rows;
};

// Student-, mentor- en docentscore per competentie naast elkaar (voor het samenbrengen)
const getEvaluatieVergelijking = async (stageId, type) => {
    const [competenties] = await pool.query(
        'SELECT competentie_id, naam, omschrijving FROM COMPETENTIE ORDER BY naam ASC'
    );
    const [rubriek] = await pool.query(
        'SELECT competentie_id, punten, omschrijving FROM RUBRIEK ORDER BY punten ASC'
    );
    const [scores] = await pool.query(
        `SELECT e.beoordelaar_rol, ec.competentie_id, ec.score, ec.commentaar
         FROM EVALUATIE e
         JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
         WHERE e.stage_id = ? AND e.type = ?`,
        [stageId, type]
    );

    const vind = (rol, compId) => {
        const rollen = rol === 'mentor' ? ['mentor', 'stagementor'] : [rol];
        return scores.find(s => rollen.includes(s.beoordelaar_rol) && s.competentie_id === compId);
    };

    return competenties.map(c => {
        const st = vind('student', c.competentie_id);
        const me = vind('mentor', c.competentie_id);
        const dc = vind('docent', c.competentie_id);
        return {
            competentie_id: c.competentie_id,
            naam: c.naam,
            omschrijving: c.omschrijving,
            niveaus: rubriek
                .filter(r => r.competentie_id === c.competentie_id)
                .map(r => ({ punten: r.punten, omschrijving: r.omschrijving })),
            score_student: st ? st.score : null,
            commentaar_student: st ? st.commentaar : null,
            score_mentor: me ? me.score : null,
            commentaar_mentor: me ? me.commentaar : null,
            score_docent: dc ? dc.score : null,
            commentaar_docent: dc ? dc.commentaar : null
        };
    });
};

// Evaluatieplanning per stage (door de docent ingesteld)
const getEvaluatiePlanning = async (stageId) => {
    const [rows] = await pool.query(
        `SELECT DATE_FORMAT(eval_tussentijds_vanaf, '%Y-%m-%d') AS tussentijds_vanaf,
                DATE_FORMAT(eval_finaal_vanaf, '%Y-%m-%d') AS finaal_vanaf
         FROM STAGE WHERE stage_id = ?`,
        [stageId]
    );
    return rows[0] || { tussentijds_vanaf: null, finaal_vanaf: null };
};

const setEvaluatiePlanning = async (stageId, tussentijds, finaal) => {
    await pool.query(
        'UPDATE STAGE SET eval_tussentijds_vanaf = ?, eval_finaal_vanaf = ? WHERE stage_id = ?',
        [tussentijds || null, finaal || null, stageId]
    );
};

module.exports = {
    getDocent,
    getStudentenMetLogboekStatus,
    getStageInfo,
    maakNotificatie,
    getMilestones,
    getDossiers,
    getMeldingenVoorStudent,
    getLogboekenVoorDocent,
    isEigenStage,
    keurLogboekWeekGoed,
    geefLogboekWeekFeedback,
    getActieveStagesMetLogboek,
    getTodos,
    getPuntenAggregatie,
    getEvaluatieVergelijking,
    getEvaluatiePlanning,
    setEvaluatiePlanning
};