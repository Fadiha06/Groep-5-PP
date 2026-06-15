const pool = require('../config/db');

// Haal studentprofiel + de actieve stage op (voor de ingelogde gebruiker)
const getStudentMetStage = async (gebruikerId) => {
    const [rows] = await pool.query(
        `SELECT s.student_id, st.stage_id, st.startdatum
        FROM STUDENT s
        JOIN STAGE st ON st.student_id = s.student_id
        WHERE s.gebruiker_id = ?
        ORDER BY st.startdatum DESC
        LIMIT 1`,
        [gebruikerId]
    );
    return rows[0]; // undefined als student of stage niet bestaat
};

// Zoek een week van een stage op weeknummer
const findWeek = async (stageId, weeknummer) => {
    const [rows] = await pool.query(
        `SELECT * FROM LOGBOEK_WEEK WHERE stage_id = ? AND weeknummer = ?`,
        [stageId, weeknummer]
    );
    return rows[0];
};

// Maak een nieuwe week aan, geeft het nieuwe week_id terug
const createWeek = async (stageId, weeknummer) => {
    const [result] = await pool.query(
        `INSERT INTO LOGBOEK_WEEK (stage_id, weeknummer, status) VALUES (?, ?, 'open')`,
        [stageId, weeknummer]
    );
    return result.insertId;
};

// Zoek een dag-entry op datum binnen een stage
const findDag = async (stageId, datum) => {
    const [rows] = await pool.query(
        `SELECT * FROM LOGBOEK_DAG WHERE stage_id = ? AND datum = ?`,
        [stageId, datum]
    );
    return rows[0];
};

// Maak een nieuwe dag-entry aan
const createDag = async (weekId, stageId, datum, uren, taken, reflectie, leerpunten) => {
    const [result] = await pool.query(
        `INSERT INTO LOGBOEK_DAG
        (week_id, stage_id, datum, uren, taken_beschrijving, reflectie, leerpunten)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [weekId, stageId, datum, uren, taken, reflectie, leerpunten]
    );
    return result.insertId;
};

// Werk een bestaande dag-entry bij
const updateDag = async (dagId, uren, taken, reflectie, leerpunten) => {
    await pool.query(
        `UPDATE LOGBOEK_DAG
        SET uren = ?, taken_beschrijving = ?, reflectie = ?, leerpunten = ?
        WHERE dag_id = ?`,
        [uren, taken, reflectie, leerpunten, dagId]
    );
};

// Haal alle dagen van een week op (gesorteerd op datum)
const getDagenVanWeek = async (weekId) => {
    const [rows] = await pool.query(
        `SELECT dag_id, datum, uren, taken_beschrijving, reflectie, leerpunten
        FROM LOGBOEK_DAG
        WHERE week_id = ?
        ORDER BY datum ASC`,
        [weekId]
    );
    return rows;
};

// Dien een week in (status + tijdstip)
const dienWeekIn = async (weekId) => {
    await pool.query(
        `UPDATE LOGBOEK_WEEK
        SET status = 'ingediend', ingediend_op = NOW()
        WHERE week_id = ?`,
        [weekId]
    );
};

const getLaatsteDag = async (gebruikerId) => {
    const [rows] = await pool.query(
        `SELECT ld.datum, ld.uren, ld.taken_beschrijving, ld.reflectie, ld.leerpunten
        FROM LOGBOEK_DAG ld
        JOIN STAGE st ON st.stage_id = ld.stage_id
        JOIN STUDENT s ON s.student_id = st.student_id
        WHERE s.gebruiker_id = ?
        ORDER BY ld.datum DESC
        LIMIT 1`,
        [gebruikerId]
    );
    return rows[0];
};

const getStageHeader = async (gebruikerId) => {
    const [rows] = await pool.query(
        `SELECT st.titel, st.startdatum, st.einddatum, b.naam AS bedrijf_naam
        FROM STUDENT s
        JOIN STAGE st ON st.student_id = s.student_id
        LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
        WHERE s.gebruiker_id = ?
        ORDER BY st.startdatum DESC LIMIT 1`,
        [gebruikerId]
    );
    return rows[0];
};

// Alle beschikbare competenties ophalen
const getAlleCompetenties = async () => {
    const [rows] = await pool.query(
        `SELECT competentie_id, naam FROM COMPETENTIE ORDER BY naam ASC`
    );
    return rows;
};

// Competenties van één dag ophalen
const getCompetentiesVanDag = async (dagId) => {
    const [rows] = await pool.query(
        `SELECT competentie_id, commentaar FROM LOGBOEK_COMPETENTIE WHERE dag_id = ?`,
        [dagId]
    );
    return rows;
};

// Competenties van een dag opslaan (eerst leegmaken, dan opnieuw invoegen)
const slaCompetentiesOp = async (dagId, studentId, competenties) => {
    await pool.query(`DELETE FROM LOGBOEK_COMPETENTIE WHERE dag_id = ?`, [dagId]);
    if (!competenties || competenties.length === 0) return;
    const values = competenties.map(c => [dagId, studentId, c.competentie_id, c.commentaar || null]);
    await pool.query(
        `INSERT INTO LOGBOEK_COMPETENTIE (dag_id, student_id, competentie_id, commentaar) VALUES ?`,
        [values]
    );
};

module.exports = {
    getStudentMetStage,
    findWeek,
    createWeek,
    findDag,
    createDag,
    updateDag,
    getDagenVanWeek,
    dienWeekIn,
    getLaatsteDag,
    getStageHeader,
    getAlleCompetenties,
    getCompetentiesVanDag,
    slaCompetentiesOp
};