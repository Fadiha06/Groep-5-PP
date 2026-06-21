const pool = require('../config/db');

// Haal docent + naam op via de ingelogde gebruiker
const getDocent = async (gebruikerId) => {
    const [rows] = await pool.query(
        `SELECT d.docent_id, CONCAT(g.voornaam, ' ', g.achternaam) AS naam
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
            CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
            b.naam AS bedrijf_naam,
            lw.status AS logboek_status,
            (SELECT SUM(uren) FROM LOGBOEK_DAG ld WHERE ld.week_id = lw.week_id) AS totaal_uren
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON st.bedrijf_id = b.bedrijf_id
        LEFT JOIN LOGBOEK_WEEK lw ON lw.stage_id = st.stage_id AND lw.weeknummer = ?
        WHERE st.leerkracht_id = ?`,
        [weeknummer, docentId]
    );
    return rows;
};

// Stage-info: student (gebruiker_id) + leerkracht - voor de reminder
const getStageInfo = async (stageId) => {
    const [rows] = await pool.query(
        `SELECT s.gebruiker_id AS student_gebruiker_id, st.leerkracht_id
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        WHERE st.stage_id = ?`,
        [stageId]
    );
    return rows;
};

// Maak een notificatie voor een student
const maakNotificatie = async (gebruikerId, stageId, titel, bericht, type) => {
    await pool.query(
        `INSERT INTO NOTIFICATIE (gebruiker_id, stage_id, titel, bericht, type, gelezen) VALUES (?, ?, ?, ?, ?, FALSE)`,
        [gebruikerId, stageId, titel, bericht, type]
    );
};

// Milestones voor studenten op basis van logboeken
const getMilestones = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT 
            CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
            st.stage_id, c.contract_id, c.student_getekend, c.mentor_getekend, c.docent_getekend
        FROM STAGE st
        LEFT JOIN CONTRACT c ON c.stage_id = st.stage_id
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        WHERE st.leerkracht_id = ? 
        `,
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
            CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam, s.opleiding, b.naam AS bedrijf_naam,
            st.status,
            st.startdatum, st.einddatum, CONCAT(st.startdatum, ' - ', st.einddatum) AS periode,
            m_g.email AS mentor_email,
            b.adres AS stageplaats_adres, g.email AS email, s.telefoonnummer, CONCAT(mg.voornaam, ' ', mg.achternaam) AS mentor_naam
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
           LEFT JOIN GEBRUIKER mg ON mg.id = st.mentor_id
        LEFT JOIN STAGEMENTOR m ON m.mentor_id = st.mentor_id
        LEFT JOIN GEBRUIKER m_g ON m_g.id = m.gebruiker_id
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


// Alle logboeken van de studenten van deze docent (voor logboeken pagina)
const getLogboeken = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT
            lw.week_id,
            lw.stage_id,
            lw.weeknummer AS week,
            lw.status,
            lw.ingediend_op AS datum,
            lw.mentor_feedback,
            lw.docent_feedback,
            lw.docent_goedgekeurd,
            CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam, s.opleiding, b.naam AS bedrijf_naam,
            CONCAT(st.startdatum, ' - ', st.einddatum) AS periode
        FROM LOGBOEK_WEEK lw
        JOIN STAGE st ON st.stage_id = lw.stage_id
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        LEFT JOIN GEBRUIKER mg ON mg.id = st.mentor_id
        WHERE st.leerkracht_id = ?
        ORDER BY lw.ingediend_op DESC`,
        [docentId]
    );
    return rows;
};

// Dagentries voor een specifieke logboekweek
const getDagenVoorWeek = async (weekId) => {
    const [rows] = await pool.query(
        `SELECT ld.*, ld.taken_beschrijving AS taken, ld.leerpunten AS problemen
        FROM LOGBOEK_DAG ld
        WHERE ld.week_id = ?
        ORDER BY ld.datum`,
        [weekId]
    );
    return rows;
};

// Goedkeur logboek week
const goedkeurLogboek = async (weekId) => {
    await pool.query(
        `UPDATE LOGBOEK_WEEK SET status = 'goedgekeurd' WHERE week_id = ?`,
        [weekId]
    );
};

// Sla feedback op voor logboek week
const slaFeedbackOp = async (weekId, feedback) => {
    await pool.query(
        `UPDATE LOGBOEK_WEEK SET mentor_feedback = ?, status = 'feedback' WHERE week_id = ?`,
        [feedback, weekId]
    );
};

// Alle studenten voor evaluatiepagina
const getEvaluatieStudenten = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT
            st.stage_id,
            CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
            s.opleiding AS klas,
            'normaal' AS status,
            (CURDATE() >= DATE_ADD(st.startdatum, INTERVAL DATEDIFF(st.einddatum, st.startdatum)/2 DAY)) AS mag_tussentijds,
            (CURDATE() >= st.einddatum) AS mag_finaal
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        WHERE st.leerkracht_id = ?`,
        [docentId]
    );
    return rows;
};

// Haal evaluaties op voor stage + week
const getEvaluaties = async (stageId, weeknummer) => {
    const [rows] = await pool.query(
        `SELECT e.evaluatie_id, e.type, e.feedback,
                ec.competentie_id, c.naam AS competentie_naam, ec.score
        FROM EVALUATIE e
        JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
        JOIN COMPETENTIE c ON c.competentie_id = ec.competentie_id
        WHERE e.stage_id = ? AND e.type = ?`,
        [stageId, `week${weeknummer}`]
    );
    return rows;
};

// Sla evaluatiescores op
const slaEvaluatieOp = async (stageId, weeknummer, beoordelaarId, scores) => {
    // Zoek bestaande evaluatie of maak nieuwe
    const type = `week${weeknummer}`;
    const [existing] = await pool.query(
        `SELECT evaluatie_id FROM EVALUATIE WHERE stage_id = ? AND type = ? AND beoordelaar_id = ?`,
        [stageId, type, beoordelaarId]
    );
    let evaluatieId;
    if (existing.length > 0) {
        evaluatieId = existing[0].evaluatie_id;
        await pool.query(`DELETE FROM EVALUATIE_COMPETENTIE WHERE evaluatie_id = ?`, [evaluatieId]);
    } else {
        const [result] = await pool.query(
            `INSERT INTO EVALUATIE (stage_id, beoordelaar_id, type, beoordelaar_rol, datum) VALUES (?, ?, ?, 'docent', CURDATE())`,
            [stageId, beoordelaarId, type]
        );
        evaluatieId = result.insertId;
    }
    for (const [competentieId, score] of Object.entries(scores)) {
        await pool.query(
            `INSERT INTO EVALUATIE_COMPETENTIE (evaluatie_id, competentie_id, score) VALUES (?, ?, ?)`,
            [evaluatieId, competentieId, score]
        );
    }
    return evaluatieId;
};

// Maak docent profiel aan
const createProfile = async (gebruikerId) => {
    const [result] = await pool.query(
        'INSERT INTO DOCENT (gebruiker_id) VALUES (?)',
        [gebruikerId]
    );
    return result.insertId;
};

// Haal competentie-scores van een dag op (zelfbeoordeling student)
const getCompetentiesVoorDag = async (dagId) => {
    const [rows] = await pool.query(
        `SELECT lc.competentie_id, c.naam, lc.score, lc.commentaar
         FROM LOGBOEK_COMPETENTIE lc
         JOIN COMPETENTIE c ON c.competentie_id = lc.competentie_id
         WHERE lc.dag_id = ?`,
        [dagId]
    );
    return rows;
};

// Aggregatie van tussentijdse scores voor de docent
const getAggregatie = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT c.naam AS competentie, AVG(ec.score) AS gemiddelde
         FROM EVALUATIE e
         JOIN STAGE st ON st.stage_id = e.stage_id
         JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
         JOIN COMPETENTIE c ON c.competentie_id = ec.competentie_id
         WHERE st.leerkracht_id = ? AND e.type = 'tussentijds' AND e.beoordelaar_rol = 'docent'
         GROUP BY c.naam
         ORDER BY gemiddelde DESC`,
        [docentId]
    );
    return rows;
};

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
module.exports = { getEvaluatieVergelijking, getEvaluatiePlanning, setEvaluatiePlanning,
    createProfile,
    getDocent,
    getStudentenMetLogboekStatus,
    getStageInfo,
    maakNotificatie,
    getMilestones,
    getDossiers,
    getMeldingenVoorStudent,
    getLogboeken,
    getDagenVoorWeek,
    goedkeurLogboek,
    slaFeedbackOp,
    getEvaluatieStudenten,
    getEvaluaties,
    slaEvaluatieOp,
    getCompetentiesVoorDag,
    getAggregatie
};














