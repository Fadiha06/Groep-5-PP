const db = require('../config/db');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { stuurWachtwoordLink } = require('../util/mail');

exports.submitStage = async (req, res) => {
    try {
        // We get the user id from the JWT token (set by authMiddleware)
        const gebruiker_id = req.user.id;
        
        const { studentnummer, bedrijfsnaam, mentorNaam, mentorEmail, telefoon, adres, sector, afdeling, titel, omschrijving, leerdoelen, uren_per_week, startdatum, einddatum } = req.body;

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

            // 2. We do NOT create Mentor Gebruiker Account anymore!
            
            // 3. Get Student ID
            const [studentRows] = await connection.query('SELECT student_id FROM STUDENT WHERE gebruiker_id = ?', [gebruiker_id]);
            if (studentRows.length === 0) {
                throw new Error('Geen student profiel gevonden voor deze gebruiker');
            }
            const student_id = studentRows[0].student_id;

            if (studentnummer) {
                await connection.query('UPDATE STUDENT SET studentnummer = ? WHERE student_id = ?', [studentnummer, student_id]);
            }

            // 4. Insert Stage with mentor_id = NULL
            await connection.query(
                'INSERT INTO STAGE (student_id, mentor_id, bedrijf_id, titel, omschrijving, leerdoelen, uren_per_week, startdatum, einddatum, status) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)',
                [student_id, bedrijf_id, titel, omschrijving, leerdoelen || null, uren_per_week || null, start, eind, 'in_aanvraag']
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
                   s.omschrijving, s.leerdoelen, s.werkregeling, s.uren_per_week, s.verwachte_competenties,
                   b.naam as bedrijfsnaam, b.adres as bedrijf_adres, b.sector as bedrijf_sector,
                   st.studentnummer, st.opleiding, st.academiejaar,
                   CONCAT(u.voornaam, ' ', u.achternaam) as studentnaam,
                   CONCAT(m_u.voornaam, ' ', m_u.achternaam) as mentornaam,
                   m_u.email as mentoremail,
                   sm.afdeling as bedrijf_afdeling
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER u ON st.gebruiker_id = u.id
            JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN GEBRUIKER m_u ON sm.gebruiker_id = m_u.id
            ORDER BY s.stage_id DESC
            LIMIT ? OFFSET ?
        `;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [stages] = await db.query(query, [limit, offset]);
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
            SELECT s.stage_id, s.titel, s.status, s.startdatum, s.einddatum,
                   s.omschrijving, s.leerdoelen, s.uren_per_week, s.reden_weigering,
                   b.naam as bedrijfsnaam, b.adres as bedrijf_adres, b.sector as bedrijf_sector,
                   st.studentnummer,
                   CONCAT(m_u.voornaam, ' ', m_u.achternaam) as mentorNaam,
                   m_u.email as mentorEmail,
                   sm.telefoonnummer as mentorTelefoon,
                   sm.afdeling as bedrijf_afdeling
            FROM STAGE s 
            JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id 
            JOIN STUDENT st ON s.student_id = st.student_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN GEBRUIKER m_u ON sm.gebruiker_id = m_u.id
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
        const { status, reden_weigering } = req.body;
        
        const allowedStatuses = ['in_aanvraag', 'goedgekeurd', 'geweigerd', 'conditie', 'actief'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Ongeldige status' });
        }
        
        await db.query('UPDATE STAGE SET status = ?, reden_weigering = ? WHERE stage_id = ?', [status, reden_weigering || null, stage_id]);
        if (status === 'goedgekeurd') {
            // === Mentor koppelen aan stage ===
            const [stageInfo] = await db.query(`
                SELECT s.bedrijf_id, b.email AS mentor_email, b.naam AS bedrijfsnaam
                FROM STAGE s
                JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
                WHERE s.stage_id = ?
            `, [stage_id]);

            if (stageInfo.length > 0 && stageInfo[0].mentor_email) {
                const { mentor_email, bedrijfsnaam } = stageInfo[0];
                const bedrijf_id = stageInfo[0].bedrijf_id;

                // 1. Zoek of maak GEBRUIKER voor de mentor
                let [bestaand] = await db.query('SELECT id FROM GEBRUIKER WHERE email = ?', [mentor_email]);
                let mentorGebruikerId;

                if (bestaand.length > 0) {
                    mentorGebruikerId = bestaand[0].id;
                } else {
                    const crypto = require('crypto');
                    const argon2 = require('argon2');
                    const randomPwd = crypto.randomBytes(16).toString('hex');
                    const hash = await argon2.hash(randomPwd);
                    const voornaam = mentor_email.split('@')[0];
                    const [nieuw] = await db.query(
                        'INSERT INTO GEBRUIKER (voornaam, achternaam, email, wachtwoord, rol) VALUES (?, ?, ?, ?, ?)',
                        [voornaam, bedrijfsnaam || '', mentor_email, hash, 'stagementor']
                    );
                    mentorGebruikerId = nieuw.insertId;
                    console.log('Mentor account aangemaakt:', mentor_email);
                }

                // 2. Zoek of maak STAGEMENTOR record
                let [mentorRecord] = await db.query('SELECT mentor_id FROM STAGEMENTOR WHERE gebruiker_id = ?', [mentorGebruikerId]);
                let mentorId;

                if (mentorRecord.length > 0) {
                    mentorId = mentorRecord[0].mentor_id;
                    // Update bedrijf koppeling indien nodig
                    await db.query('UPDATE STAGEMENTOR SET bedrijf_id = ? WHERE mentor_id = ?', [bedrijf_id, mentorId]);
                } else {
                    const [nieuweMentor] = await db.query(
                        'INSERT INTO STAGEMENTOR (gebruiker_id, bedrijf_id) VALUES (?, ?)',
                        [mentorGebruikerId, bedrijf_id]
                    );
                    mentorId = nieuweMentor.insertId;
                }

                // 3. Koppel mentor aan stage
                await db.query('UPDATE STAGE SET mentor_id = ? WHERE stage_id = ?', [mentorId, stage_id]);
                console.log('Mentor gekoppeld aan stage:', stage_id, 'mentor_id:', mentorId);
            }

            // === Contract aanmaken ===
            const [insertResult] = await db.query('INSERT INTO CONTRACT (stage_id, inhoud) VALUES (?, ?)', [stage_id, 'Standaard contract opgesteld door systeem']);
            const contractId = insertResult.insertId;

            const { stuurContractLink } = require('../util/mail');
            const jwt = require('jsonwebtoken');

            const [bedrijfRows] = await db.query(`
                SELECT b.email 
                FROM STAGE s 
                JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id 
                WHERE s.stage_id = ?
            `, [stage_id]);

            if (bedrijfRows.length > 0 && bedrijfRows[0].email) {
                const email = bedrijfRows[0].email;
                const token = jwt.sign({ contractId: contractId, type: 'mentor_sign' }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '48h' });
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                await stuurContractLink(email, `${frontendUrl}/mentor_contract.html?token=${token}`);
                console.log('Contract link verzonden naar bedrijf email:', email);
            }
        }
        res.json({ message: 'Status bijgewerkt naar ' + status });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Fout bij het updaten van de status' });
    }
};
