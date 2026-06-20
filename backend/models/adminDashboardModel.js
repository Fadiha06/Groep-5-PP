const db = require('../config/db');

class AdminDashboardModel {
    static async getStats() {
        const [studenten] = await db.query("SELECT COUNT(*) AS total_students FROM GEBRUIKER WHERE rol = 'student'");
        // Contracten die de stagecommissie al gecontroleerd + getekend heeft, en die de
        // admin nog moet versturen naar student en bedrijf (zie ook getTeVersturen()).
        const [teVersturen] = await db.query(`
            SELECT COUNT(*) AS te_versturen
            FROM CONTRACT c
            WHERE c.docent_getekend = 1 AND c.verzonden_op IS NULL
        `);
        const totalStudents = studenten[0].total_students;
        const pendingContracts = teVersturen[0].te_versturen;
        const legalCheck = 0; // Juridische controle gebeurt nu bij de stagecommissie, niet bij admin.
        const activeExtensions = 0; // Geen tabel voor verlengingen momenteel
        const melding = pendingContracts === 1
            ? '1 contract is klaar om verstuurd te worden.'
            : `${pendingContracts} contracten zijn klaar om verstuurd te worden.`;

        return {
            totalStudents,
            pendingContracts,
            legalCheck,
            activeExtensions,
            melding
        };
    }

    static async getAllStages() {
        const query = `
            SELECT 
                s.stage_id,
                c.contract_id,
                CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                st.opleiding,
                b.naam AS bedrijf_naam,
                s.status AS aanvraag_status,
                CASE 
                    WHEN c.student_getekend = 1 AND c.mentor_getekend = 1 THEN 'voltooid'
                    ELSE 'in_review'
                END AS contract_status
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            JOIN CONTRACT c ON s.stage_id = c.stage_id
            WHERE g.rol = 'student'
            ORDER BY s.stage_id DESC
        `;
        const [rows] = await db.query(query);
        return rows;
    }
    static async getContractDetails(stageId) {
        const query = `
            SELECT 
                s.stage_id, s.status, s.startdatum, s.einddatum, s.titel,
                CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam, st.opleiding,
                b.naam AS bedrijf_naam,
                c.student_getekend, c.mentor_getekend, c.getekend_op, c.contract_id
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN CONTRACT c ON s.stage_id = c.stage_id
            WHERE s.stage_id = ?
        `;
        const [rows] = await db.query(query, [stageId]);
        return rows[0] || null;
    }

    static async getContractControle(contractId) {
        const query = `
            SELECT 
                c.contract_id,
                b.naam AS bedrijf_naam,
                CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                st.opleiding,
                s.startdatum AS periode_start,
                s.einddatum AS periode_eind,
                s.status AS status_contract,
                c.aangemaakt_op AS ingediend_op,
                c.student_getekend, c.mentor_getekend, c.docent_getekend, c.getekend_op
            FROM CONTRACT c
            JOIN STAGE s ON c.stage_id = s.stage_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE c.contract_id = ?
        `;
        const [rows] = await db.query(query, [contractId]);
        return rows[0] || null;
    }

    static async getActionRequired() {
        const query = `
            SELECT 
                c.contract_id,
                b.naam AS bedrijf_naam,
                CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                st.opleiding,
                c.aangemaakt_op AS ingediend_op,
                TRUE AS risicoanalyse_ok, 
                c.mentor_getekend,
                c.student_getekend,
                'Compleet' AS verzekering_status 
            FROM STAGE s
            JOIN CONTRACT c ON s.stage_id = c.stage_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE g.rol = 'student'
              AND (c.docent_getekend = 0 OR c.docent_getekend IS NULL)
            ORDER BY c.aangemaakt_op DESC
        `;
        const [rows] = await db.query(query);
        return rows;
    }

    static async getActivity() {
        const query = `
            SELECT 
                'Nieuw contract ingediend' AS titel,
                DATE_FORMAT(c.aangemaakt_op, '%d-%m-%Y %H:%i') AS tijd_geleden,
                CONCAT(g.voornaam, ' ', g.achternaam) AS door
            FROM CONTRACT c
            JOIN STAGE s ON c.stage_id = s.stage_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            ORDER BY c.aangemaakt_op DESC
            LIMIT 5
        `;
        const [rows] = await db.query(query);
        return rows;
    }

    static async updateContractStatus(stageId, status, reden_weigering = null) {
        await db.query(
            'UPDATE STAGE SET status = ?, reden_weigering = ?, goedkeuringsdatum = CASE WHEN ? = "goedgekeurd" THEN CURRENT_DATE ELSE NULL END WHERE stage_id = ?',
            [status, reden_weigering, status, stageId]
        );
        if (status === 'goedgekeurd') {
            await db.query('INSERT IGNORE INTO CONTRACT (stage_id, inhoud) VALUES (?, ?)', [stageId, 'Standaard contract opgesteld door systeem']);
        }
    }

    static async getStudentReports() {
        const query = `
            SELECT 
                st.studentnummer,
                CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                st.opleiding,
                b.naam AS bedrijf_naam,
                s.status AS stage_status,
                COALESCE(SUM(ec.score), 0) AS totaal_score
            FROM STUDENT st
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            JOIN STAGE s ON st.student_id = s.student_id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN EVALUATIE e ON s.stage_id = e.stage_id
            LEFT JOIN EVALUATIE_COMPETENTIE ec ON e.evaluatie_id = ec.evaluatie_id
            GROUP BY st.student_id, s.stage_id
            ORDER BY CONCAT(g.voornaam, ' ', g.achternaam) ASC
        `;
        const [rows] = await db.query(query);
        return rows;
    }
    static async updateContractState(contractId, status, opmerking) {
        const [rows] = await db.query('SELECT stage_id FROM CONTRACT WHERE contract_id = ?', [contractId]);
        if (rows.length > 0) {
            const stageId = rows[0].stage_id;
            await db.query('UPDATE STAGE SET status = ?, reden_weigering = ? WHERE stage_id = ?', [status, opmerking, stageId]);
            if (status === 'goedgekeurd') {
                await db.query('INSERT IGNORE INTO CONTRACT (stage_id, inhoud) VALUES (?, ?)', [stageId, 'Standaard contract opgesteld door systeem']);
            }
        }
    }

    static async getAdminRapporten() {
        const query = `
            SELECT 
                s.stage_id,
                CONCAT(g.voornaam, ' ', g.achternaam) AS naam,
                b.naam AS bedrijf,
                COALESCE(SUM(ec.score), 0) AS totaal
            FROM STUDENT st
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            JOIN STAGE s ON st.student_id = s.student_id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN EVALUATIE e ON s.stage_id = e.stage_id
            LEFT JOIN EVALUATIE_COMPETENTIE ec ON e.evaluatie_id = ec.evaluatie_id
            WHERE g.rol = 'student'
            GROUP BY s.stage_id, CONCAT(g.voornaam, ' ', g.achternaam), b.naam
        `;
        const [studenten] = await db.query(query);

        return {
            competenties: [
                { id: 1, label: 'Zelfstandigheid' },
                { id: 2, label: 'Teamwerk' },
                { id: 3, label: 'Inzicht' }
            ],
            studenten: studenten.map(st => ({
                stage_id: st.stage_id,
                naam: st.naam,
                bedrijf: st.bedrijf || 'Geen',
                scores: { 1: 3, 2: 4, 3: 5 }, 
                totaal: st.totaal,
                totaal_max: 20
            }))
        };
    }
}

module.exports = AdminDashboardModel;
