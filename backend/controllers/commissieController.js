const db = require('../config/db');

exports.getStages = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.stage_id, s.titel, s.status, s.startdatum, s.einddatum,
                   s.omschrijving, s.feedback_commissie,
                   CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                   b.naam AS bedrijf_naam,
                   CONCAT(m_u.voornaam, ' ', m_u.achternaam) AS mentornaam,
                   c.contract_id, c.docent_getekend, c.student_getekend, c.mentor_getekend
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN GEBRUIKER m_u ON sm.gebruiker_id = m_u.id
            LEFT JOIN CONTRACT c ON s.stage_id = c.stage_id
            ORDER BY s.stage_id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching stages for commissie:', err);
        res.status(500).json({ error: 'Serverfout bij ophalen stages' });
    }
};

exports.getStageDetails = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, 
                   CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                   st.studentnummer, st.opleiding,
                   b.naam AS bedrijf_naam, b.adres AS bedrijf_adres, b.sector AS bedrijf_sector,
                   CONCAT(m_u.voornaam, ' ', m_u.achternaam) AS mentornaam,
                   m_u.email AS mentoremail,
                   c.contract_id, c.student_getekend, c.mentor_getekend, c.docent_getekend, c.getekend_op
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN GEBRUIKER m_u ON sm.gebruiker_id = m_u.id
            LEFT JOIN CONTRACT c ON s.stage_id = c.stage_id
            WHERE s.stage_id = ?
        `, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Stage niet gevonden' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching stage details:', err);
        res.status(500).json({ error: 'Serverfout bij ophalen stage details' });
    }
};

exports.beoordeelStage = async (req, res) => {
    try {
        const { status, feedback_commissie } = req.body;
        const stageId = req.params.id;

        if (!status || !['goedgekeurd', 'geweigerd', 'conditie'].includes(status)) {
            return res.status(400).json({ error: 'Ongeldige status. Moet goedgekeurd, geweigerd of conditie zijn.' });
        }

        await db.query(
            'UPDATE STAGE SET status = ?, feedback_commissie = ?, goedkeuringsdatum = CASE WHEN ? = "goedgekeurd" THEN CURRENT_DATE ELSE NULL END WHERE stage_id = ?',
            [status, feedback_commissie || null, status, stageId]
        );

        if (status === 'goedgekeurd') {
            const [existing] = await db.query('SELECT contract_id FROM CONTRACT WHERE stage_id = ?', [stageId]);
            if (existing.length === 0) {
                await db.query('INSERT INTO CONTRACT (stage_id, inhoud) VALUES (?, ?)', [stageId, 'Standaard contract opgesteld door systeem']);
            }
        }

        res.json({ message: `Stage succesvol ${status}` });
    } catch (err) {
        console.error('Error beoordelen stage:', err);
        res.status(500).json({ error: 'Serverfout bij beoordelen stage' });
    }
};
