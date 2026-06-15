const pool = require('../config/db');

class StudentModel {

    static async getTussentijdseEvaluatie(student_id) {
        const [stages] = await pool.query(
            `SELECT stage_id FROM STAGE WHERE student_id = ? ORDER BY stage_id DESC LIMIT 1`,
            [student_id]
        );
        if (!stages.length) return null;
        const { stage_id } = stages[0];

        const [evaluaties] = await pool.query(
            `SELECT e.evaluatie_id, e.datum, e.feedback, e.beoordelaar_rol,
                    g.naam AS beoordelaar_naam
             FROM EVALUATIE e
             JOIN GEBRUIKER g ON e.beoordelaar_id = g.id
             WHERE e.stage_id = ? AND e.type = 'tussentijds'`,
            [stage_id]
        );

        const [competenties] = await pool.query(
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
        const [stages] = await pool.query(
            `SELECT stage_id FROM STAGE WHERE student_id = ? ORDER BY stage_id DESC LIMIT 1`,
            [student_id]
        );
        if (!stages.length) return null;
        const { stage_id } = stages[0];

        const [evaluaties] = await pool.query(
            `SELECT e.evaluatie_id, e.datum, e.feedback, e.beoordelaar_rol,
                    g.naam AS beoordelaar_naam
             FROM EVALUATIE e
             JOIN GEBRUIKER g ON e.beoordelaar_id = g.id
             WHERE e.stage_id = ? AND e.type = 'finaal'`,
            [stage_id]
        );

        const [competenties] = await pool.query(
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