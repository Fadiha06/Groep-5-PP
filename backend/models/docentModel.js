const db = require('../config/db');

class DocentModel {
    static async createProfile(gebruiker_id) {
        const [result] = await db.query('INSERT INTO DOCENT (gebruiker_id) VALUES (?)', [gebruiker_id]);
        return result.insertId;
    }
}

module.exports = DocentModel;
