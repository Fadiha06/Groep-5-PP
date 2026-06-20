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
                    CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam, s.studentnummer, s.opleiding,
                    st.titel, st.startdatum, st.einddatum,
                    b.naam AS bedrijf_naam,
                    CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam, gm.email AS mentor_email,
                    CONCAT(gd.voornaam, ' ', gd.achternaam) AS docent_naam
             FROM CONTRACT c
             JOIN STAGE st ON st.stage_id = c.stage_id
             JOIN STUDENT s ON s.student_id = st.student_id
             JOIN GEBRUIKER g ON g.id = s.gebruiker_id
             LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
             LEFT JOIN STAGEMENTOR sm ON sm.mentor_id = st.mentor_id
             LEFT JOIN GEBRUIKER gm ON gm.id = sm.gebruiker_id
             LEFT JOIN DOCENT d ON d.docent_id = st.leerkracht_id
             LEFT JOIN GEBRUIKER gd ON gd.id = d.gebruiker_id
             WHERE g.id = ?
             ORDER BY c.contract_id DESC
             LIMIT 1`,
            [gebruikerId]
        );
        return rows[0];
    }
    // 💡💡💡 EINDE NIEUW 💡💡💡

    static async getDetailsById(contractId) {
        const [rows] = await pool.query(
            `SELECT c.*,
                    CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam, s.studentnummer, s.opleiding,
                    st.titel, st.startdatum, st.einddatum,
                    b.naam AS bedrijf_naam,
                    CONCAT(gm.voornaam, ' ', gm.achternaam) AS mentor_naam, gm.email AS mentor_email,
                    CONCAT(gd.voornaam, ' ', gd.achternaam) AS docent_naam
             FROM CONTRACT c
             JOIN STAGE st ON st.stage_id = c.stage_id
             JOIN STUDENT s ON s.student_id = st.student_id
             JOIN GEBRUIKER g ON g.id = s.gebruiker_id
             LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
             LEFT JOIN STAGEMENTOR sm ON sm.mentor_id = st.mentor_id
             LEFT JOIN GEBRUIKER gm ON gm.id = sm.gebruiker_id
             LEFT JOIN DOCENT d ON d.docent_id = st.leerkracht_id
             LEFT JOIN GEBRUIKER gd ON gd.id = d.gebruiker_id
             WHERE c.contract_id = ?`,
            [contractId]
        );
        return rows[0];
    }

    static async getBedrijfEmail(contractId) {
        const [rows] = await pool.query(
            `SELECT b.email
             FROM CONTRACT c
             JOIN STAGE st ON st.stage_id = c.stage_id
             LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
             WHERE c.contract_id = ?`,
            [contractId]
        );
        return rows[0] ? rows[0].email : null;
    }

    static async signAsDocent(contractId, signatureBase64) {
        await pool.query(
            `UPDATE CONTRACT
             SET docent_getekend = TRUE, docent_handtekening = ?
             WHERE contract_id = ?`,
            [signatureBase64, contractId]
        );
        await this.checkAllSigned(contractId);
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
        if (contract && contract.student_getekend && contract.mentor_getekend && contract.docent_getekend) {
            await pool.query(
                `UPDATE CONTRACT SET getekend_op = CURRENT_TIMESTAMP WHERE contract_id = ?`,
                [contractId]
            );
            // Zet de stage op 'actief' zodra alle partijen getekend hebben
            await pool.query(
                `UPDATE STAGE SET status = 'actief' WHERE stage_id = ?`,
                [contract.stage_id]
            );
        }
    }

}



module.exports = ContractModel;
