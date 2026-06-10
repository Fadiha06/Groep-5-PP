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

}
module.exports = StudentModel;
