const db = require('../config/db');

class CommissieModel {
    static async createProfile(gebruiker_id) {
        const [result] = await db.query('INSERT INTO STAGECOMMISSIE (gebruiker_id) VALUES (?)', [gebruiker_id]);
        return result.insertId;
    }
}

module.exports = CommissieModel;
