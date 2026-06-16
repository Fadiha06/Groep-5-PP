const db = require('../config/db');

exports.submitStage = async (req, res) => {
    try {
        // We get the user id from the JWT token (set by authMiddleware)
        const gebruiker_id = req.user.id;
        
        const { bedrijfsnaam, mentorNaam, mentorEmail, telefoon, adres, sector, titel, omschrijving, startdatum, einddatum } = req.body;

        if (!bedrijfsnaam || !titel || !omschrijving) {
            return res.status(400).json({ error: 'Bedrijfsnaam, titel en omschrijving zijn verplicht.' });
        }

        const start = startdatum ? startdatum : null;
        const eind = einddatum ? einddatum : null;

        // Start transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Insert Bedrijf
            const [bedrijfResult] = await connection.query(
                'INSERT INTO BEDRIJF (naam, adres, telefoon, email, sector) VALUES (?, ?, ?, ?, ?)',
                [bedrijfsnaam, adres, telefoon, mentorEmail, sector]
            );
            const bedrijf_id = bedrijfResult.insertId;

            // 2. Insert Mentor
            const [mentorResult] = await connection.query(
                'INSERT INTO STAGEMENTOR (bedrijf_id, telefoonnummer) VALUES (?, ?)',
                [bedrijf_id, telefoon]
            );
            const mentor_id = mentorResult.insertId;

            // 3. Get Student ID
            const [studentRows] = await connection.query('SELECT student_id FROM STUDENT WHERE gebruiker_id = ?', [gebruiker_id]);
            if (studentRows.length === 0) {
                throw new Error('Geen student profiel gevonden voor deze gebruiker');
            }
            const student_id = studentRows[0].student_id;

            // 4. Insert Stage
            await connection.query(
                'INSERT INTO STAGE (student_id, mentor_id, bedrijf_id, titel, omschrijving, startdatum, einddatum, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [student_id, mentor_id, bedrijf_id, titel, omschrijving, start, eind, 'in_aanvraag']
            );

            await connection.commit();
            connection.release();

            res.status(201).json({ message: 'Stageaanvraag succesvol ingediend!' });

        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }

    } catch (error) {
        console.error('Submit stage error:', error);
        res.status(500).json({ error: 'Fout bij het indienen van stageaanvraag' });
    }
};

exports.getAllStages = async (req, res) => {
    try {
        const query = `
            SELECT s.stage_id, s.titel, s.status, s.startdatum, s.einddatum,
                   b.naam as bedrijfsnaam,
                   u.naam as studentnaam
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER u ON st.gebruiker_id = u.id
            JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
        `;
        const [stages] = await db.query(query);
        res.json(stages);
    } catch (error) {
        console.error('Get stages error:', error);
        res.status(500).json({ error: 'Fout bij het ophalen van stages' });
    }
};

exports.getMyStage = async (req, res) => {
    try {
        const gebruiker_id = req.user.id;
        
        // Find student ID
        const [studentRows] = await db.query('SELECT student_id FROM STUDENT WHERE gebruiker_id = ?', [gebruiker_id]);
        if (studentRows.length === 0) return res.json({ stage: null });
        const student_id = studentRows[0].student_id;

        // Find stage
        const [stageRows] = await db.query(`
            SELECT s.titel, s.status, s.startdatum, s.einddatum, b.naam as bedrijfsnaam 
            FROM STAGE s 
            JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id 
            WHERE s.student_id = ? 
            ORDER BY s.stage_id DESC LIMIT 1
        `, [student_id]);

        if (stageRows.length === 0) {
            return res.json({ stage: null });
        }

        res.json({ stage: stageRows[0] });
    } catch (error) {
        console.error('Get my stage error:', error);
        res.status(500).json({ error: 'Fout bij het ophalen van je stage' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const stage_id = req.params.id;
        const { status } = req.body;
        
        const allowedStatuses = ['in_aanvraag', 'goedgekeurd', 'geweigerd', 'conditie', 'actief'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Ongeldige status' });
        }
        
        await db.query('UPDATE STAGE SET status = ? WHERE stage_id = ?', [status, stage_id]);
        res.json({ message: 'Status bijgewerkt naar ' + status });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Fout bij het updaten van de status' });
    }
};
