const db = require('../config/db');

class AdminModel {
    static async createProfile(gebruiker_id, niveau = 'hoofdadmin') {
        const [result] = await db.query('INSERT INTO ADMINISTRATIE (gebruiker_id, bevoegdheidsniveau) VALUES (?, ?)', [gebruiker_id, niveau]);
        return result.insertId;
    }
}

module.exports = AdminModel;
