const db = require('../config/db');

class StageModel {
   
    static async getAllStages() {
        const [rows] = await db.query('SELECT * FROM STAGE');
        return rows;
    }
}

module.exports = StageModel;
