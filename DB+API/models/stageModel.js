const pool = require('../config/db');

class StageModel {

    static async createVoorstel(studentId, bedrijfId, titel, omschrijving, startdatum, einddatum) {
        const [result] = await pool.query(
            `INSERT INTO STAGE 
            (student_id, bedrijf_id, titel, omschrijving, startdatum, einddatum) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [studentId, bedrijfId, titel, omschrijving, startdatum, einddatum]
        );
        return result.insertId;
    }
}

module.exports = StageModel;
