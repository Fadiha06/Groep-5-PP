const db = require('../config/db');

class StudentModel {
    static async createProfile(gebruiker_id) {
        const [result] = await db.query('INSERT INTO STUDENT (gebruiker_id) VALUES (?)', [gebruiker_id]);
        return result.insertId;
    }
}

module.exports = StudentModel;
