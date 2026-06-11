const pool = require('../config/db');


class ContractModel{


    static async getById(contractId) {
        const [rows] = await pool.query('SELECT * FROM CONTRACT WHERE contract_id = ?', [contractId]);
        return rows[0];
    }

    static async signAsStudent(contractId, signatureBase64) {
        await pool.query(
            `UPDATE CONTRACT 
             SET student_getekend = TRUE, student_handtekening = ?
             WHERE contract_id = ?`,
            [signatureBase64, contractId]
        );
        await this.checkAllSigned(contractId);
    }


}



module.exports = ContractModel;