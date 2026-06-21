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
        `SELECT st.stage_id, st.leerkracht_id, s.gebruiker_id AS student_gebruiker_id, CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam
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
            CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
            c.contract_id,
            c.student_getekend,
            c.mentor_getekend,
            c.docent_getekend
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
            CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
            s.studentnummer,
            s.opleiding,
            g.email,
            s.telefoonnummer AS student_telefoon,
            b.naam AS bedrijf_naam,
            b.adres AS bedrijf_adres,
            b.stad AS bedrijf_stad,
            st.startdatum,
            st.einddatum,
            CONCAT(m_u.voornaam, ' ', m_u.achternaam) AS stagementor_naam
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        LEFT JOIN STAGEMENTOR sm ON st.mentor_id = sm.mentor_id
        LEFT JOIN GEBRUIKER m_u ON sm.gebruiker_id = m_u.id
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
            CONCAT(g.voornaam, ' ', g.achternaam) AS naam,
            s.opleiding,
            b.naam AS bedrijf,
            CONCAT(st.startdatum, ' - ', st.einddatum) AS periode
        FROM LOGBOEK_WEEK lw
        JOIN STAGE st ON st.stage_id = lw.stage_id
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        WHERE st.leerkracht_id = ?
        ORDER BY lw.ingediend_op DESC`,
        [docentId]
    );
    return rows;
};

// Dagentries voor een specifieke logboekweek
const getDagenVoorWeek = async (weekId) => {
    const [rows] = await pool.query(
        `SELECT ld.dag_id, ld.datum, ld.uren, ld.taken_beschrijving AS taken, ld.leerpunten AS problemen, ld.status
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
        `UPDATE LOGBOEK_WEEK SET docent_goedgekeurd = TRUE, status = 'goedgekeurd' WHERE week_id = ?`,
        [weekId]
    );
};

// Sla feedback op voor logboek week (docent feedback)
const slaFeedbackOp = async (weekId, feedback) => {
    await pool.query(
        `UPDATE LOGBOEK_WEEK SET docent_feedback = ?, status = 'feedback' WHERE week_id = ?`,
        [feedback, weekId]
    );
};

// Alle studenten voor evaluatiepagina
const getEvaluatieStudenten = async (docentId) => {
    const [rows] = await pool.query(
        `SELECT
            st.stage_id,
            CONCAT(g.voornaam, ' ', g.achternaam) AS naam,
            s.opleiding AS klas,
            'normaal' AS status,
            st.startdatum,
            st.einddatum
        FROM STAGE st
        JOIN STUDENT s ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON g.id = s.gebruiker_id
        WHERE st.leerkracht_id = ?`,
        [docentId]
    );
    return rows;
};

// Haal evaluaties op voor stage + week — gestructureerd per competentie
const getEvaluaties = async (stageId, weeknummer) => {
    const type = `week${weeknummer}`;

    // 1. Haal de opleiding van de student op
    const [stageRows] = await pool.query(
        `SELECT s.opleiding FROM STAGE st
         JOIN STUDENT s ON s.student_id = st.student_id
         WHERE st.stage_id = ?`,
        [stageId]
    );
    if (stageRows.length === 0) return [];
    const opleiding = stageRows[0].opleiding;

    // 2. Haal alle competenties voor deze opleiding
    const [competenties] = await pool.query(
        `SELECT competentie_id, naam, omschrijving FROM COMPETENTIE WHERE opleiding = ?`,
        [opleiding]
    );
    if (competenties.length === 0) return [];

    const competentieIds = competenties.map(c => c.competentie_id);

    // 3. Haal alle rubriek-opties op voor deze competenties
    const [rubrieken] = await pool.query(
        `SELECT competentie_id, punten, omschrijving FROM RUBRIEK
         WHERE competentie_id IN (?) ORDER BY competentie_id, punten`,
        [competentieIds]
    );

    // Groepeer opties per competentie
    const optiesPerCompetentie = {};
    rubrieken.forEach(r => {
        if (!optiesPerCompetentie[r.competentie_id]) optiesPerCompetentie[r.competentie_id] = [];
        optiesPerCompetentie[r.competentie_id].push({
            score: r.punten,
            label: `${r.punten} ptn`,
            beschrijving: r.omschrijving || ''
        });
    });

    // 4. Haal student zelfbeoordeling op (geagereerd per competentie over alle dagen van de week)
    const [logboekWeken] = await pool.query(
        `SELECT week_id FROM LOGBOEK_WEEK WHERE stage_id = ? AND weeknummer = ?`,
        [stageId, weeknummer]
    );

    let studentScores = {};
    let feedbackStudent = '';
    if (logboekWeken.length > 0) {
        const weekId = logboekWeken[0].week_id;
        const [dagIds] = await pool.query(
            `SELECT dag_id FROM LOGBOEK_DAG WHERE week_id = ?`,
            [weekId]
        );
        if (dagIds.length > 0) {
            const ids = dagIds.map(d => d.dag_id);
            const [studentScoresRows] = await pool.query(
                `SELECT competentie_id, AVG(score) AS gem_score
                 FROM LOGBOEK_COMPETENTIE
                 WHERE dag_id IN (?)
                 GROUP BY competentie_id`,
                [ids]
            );
            studentScoresRows.forEach(s => {
                studentScores[s.competentie_id] = Math.round(s.gem_score * 10) / 10;
            });
        }

        // Haal mentor feedback op uit LOGBOEK_WEEK
        const [weekData] = await pool.query(
            `SELECT mentor_feedback FROM LOGBOEK_WEEK WHERE week_id = ?`,
            [weekId]
        );
        if (weekData.length > 0) feedbackStudent = weekData[0].mentor_feedback || '';
    }

    // 5. Haal mentor evaluatie op (week-based)
    let mentorScores = {};
    let feedbackMentor = '';
    const [mentorEval] = await pool.query(
        `SELECT ec.competentie_id, ec.score, e.feedback
         FROM EVALUATIE e
         JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
         WHERE e.stage_id = ? AND e.type = ? AND e.beoordelaar_rol = 'mentor'`,
        [stageId, type]
    );
    mentorEval.forEach(m => {
        mentorScores[m.competentie_id] = m.score;
        if (m.feedback) feedbackMentor = m.feedback;
    });

    // 6. Haal ook tussentijdse/finaale mentor evaluaties op
    let mentorTussentijds = null;
    let mentorFinaal = null;
    const [tussentijdsEval] = await pool.query(
        `SELECT e.feedback,
                JSON_ARRAYAGG(JSON_OBJECT('competentie_id', ec.competentie_id, 'score', ec.score)) AS scores
         FROM EVALUATIE e
         JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
         WHERE e.stage_id = ? AND e.type = 'tussentijds' AND e.beoordelaar_rol = 'mentor'
         GROUP BY e.evaluatie_id`,
        [stageId]
    );
    if (tussentijdsEval.length > 0) {
        mentorTussentijds = {
            feedback: tussentijdsEval[0].feedback,
            scores: JSON.parse(tussentijdsEval[0].scores || '[]')
        };
    }

    const [finaalEval] = await pool.query(
        `SELECT e.feedback,
                JSON_ARRAYAGG(JSON_OBJECT('competentie_id', ec.competentie_id, 'score', ec.score)) AS scores
         FROM EVALUATIE e
         JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
         WHERE e.stage_id = ? AND e.type = 'finaal' AND e.beoordelaar_rol = 'mentor'
         GROUP BY e.evaluatie_id`,
        [stageId]
    );
    if (finaalEval.length > 0) {
        mentorFinaal = {
            feedback: finaalEval[0].feedback,
            scores: JSON.parse(finaalEval[0].scores || '[]')
        };
    }

    // 7. Haal docent evaluatie op
    let docentScores = {};
    const [docentEval] = await pool.query(
        `SELECT ec.competentie_id, ec.score
         FROM EVALUATIE e
         JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
         WHERE e.stage_id = ? AND e.type = ? AND e.beoordelaar_rol = 'docent'`,
        [stageId, type]
    );
    docentEval.forEach(d => {
        docentScores[d.competentie_id] = d.score;
    });

    // 8. Bouw de gestructureerde response op
    return {
        competenties: competenties.map(c => ({
            competentie_id: c.competentie_id,
            naam: c.naam,
            domeinen: c.omschrijving || '',
            opties: optiesPerCompetentie[c.competentie_id] || [],
            score_student: studentScores[c.competentie_id] ?? null,
            score_mentor: mentorScores[c.competentie_id] ?? null,
            score_docent: docentScores[c.competentie_id] ?? null,
            feedback_mentor: feedbackMentor,
            feedback_student: feedbackStudent
        })),
        mentor_tussentijds: mentorTussentijds,
        mentor_finaal: mentorFinaal
    };
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

// Maak docent profiel aan
const createProfile = async (gebruikerId) => {
    const [result] = await pool.query(
        'INSERT INTO DOCENT (gebruiker_id) VALUES (?)',
        [gebruikerId]
    );
    return result.insertId;
};


module.exports = {
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
    getCompetentiesVoorDag
};
