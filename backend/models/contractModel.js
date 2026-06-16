const pool = require('../config/db');


class ContractModel{


    static async getById(contractId) {
        const [rows] = await pool.query('SELECT * FROM CONTRACT WHERE contract_id = ?', [contractId]);
        return rows[0];
    }

    // ↓↓↓ NIEUW: contract + weergavegegevens van de ingelogde student ↓↓↓
    static async getByGebruiker(gebruikerId) {
        const [rows] = await pool.query(
            `SELECT c.*,
                    g.naam AS student_naam, s.studentnummer,
                    st.titel, st.startdatum, st.einddatum,
                    b.naam AS bedrijf_naam
             FROM CONTRACT c
             JOIN STAGE st ON st.stage_id = c.stage_id
             JOIN STUDENT s ON s.student_id = st.student_id
             JOIN GEBRUIKER g ON g.id = s.gebruiker_id
             LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
             WHERE g.id = ?
             ORDER BY c.contract_id DESC
             LIMIT 1`,
            [gebruikerId]
        );
        return rows[0];
    }
    // ↑↑↑ EINDE NIEUW ↑↑↑

    static async signAsStudent(contractId, signatureBase64) {
        await pool.query(
            `UPDATE CONTRACT 
             SET student_getekend = TRUE, student_handtekening = ?
             WHERE contract_id = ?`,
            [signatureBase64, contractId]
        );
        await this.checkAllSigned(contractId);
    }

    static async signAsMentor(contractId, signatureBase64) {
        await pool.query(
            `UPDATE CONTRACT 
             SET mentor_getekend = TRUE, mentor_handtekening = ?
             WHERE contract_id = ?`,
            [signatureBase64, contractId]
        );
        await this.checkAllSigned(contractId);
    }

    static async checkAllSigned(contractId) {
        const contract = await this.getById(contractId);
        if (contract && contract.student_getekend && contract.mentor_getekend) {
            await pool.query(
                `UPDATE CONTRACT SET getekend_op = CURRENT_TIMESTAMP WHERE contract_id = ?`,
                [contractId]
            );
        }
    }

}



module.exports = ContractModel;