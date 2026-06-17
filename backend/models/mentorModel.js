const pool = require('../config/db');

class MentorModel{
    static async createProfile(gebruiker_id) {
        const query = 'INSERT INTO STAGEMENTOR (gebruiker_id, bedrijf_id) VALUES (?, NULL)';
        const [result] = await pool.query(query, [gebruiker_id]);
        return result.insertId;
    }
}
module.exports = MentorModel; 