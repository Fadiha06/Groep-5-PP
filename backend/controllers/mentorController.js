const db = require('../config/db');

async function vindStagesVoorGebruiker(gebruikerId) {
    const [stages] = await db.query(`
        SELECT DISTINCT s.stage_id, s.status, s.startdatum, s.einddatum,
               st.opleiding,
               CONCAT(g.voornaam, ' ', g.achternaam) as studentnaam,
               b.naam as bedrijfsnaam
        FROM STAGE s
        JOIN STUDENT st ON s.student_id = st.student_id
        JOIN GEBRUIKER g ON st.gebruiker_id = g.id
        LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
        LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
        LEFT JOIN DOCENT d ON s.leerkracht_id = d.docent_id
        WHERE sm.gebruiker_id = ? OR d.gebruiker_id = ?
    `, [gebruikerId, gebruikerId]);
    return stages;
}

// 1. Get all students (stages) assigned to this mentor
exports.getStudenten = async (req, res) => {
    try {
        const stages = await vindStagesVoorGebruiker(req.user.id);
        res.json(stages);
    } catch (err) {
        console.error('Error fetching studenten:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 2. Get pending logboeken for this mentor's students
exports.getPendingLogboeken = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        
        const [weken] = await db.query(`
            SELECT lw.week_id, lw.stage_id, lw.weeknummer as week_nr, lw.status, lw.ingediend_op,
                   CONCAT(g.voornaam, ' ', g.achternaam) as studentnaam, b.naam as bedrijfsnaam
            FROM LOGBOEK_WEEK lw
            JOIN STAGE s ON lw.stage_id = s.stage_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN DOCENT d ON s.leerkracht_id = d.docent_id
            WHERE (sm.gebruiker_id = ? OR d.gebruiker_id = ?) AND lw.status = 'ingediend'
            ORDER BY lw.ingediend_op DESC
        `, [gebruikerId, gebruikerId]);
        res.json(weken);
    } catch (err) {
        console.error('Error fetching pending logboeken:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 3. Get all logboeken (grouped by student/stage)
exports.getAllLogboeken = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        
        const [logboeken] = await db.query(`
            SELECT s.stage_id as logboek_id, s.stage_id,
                   CONCAT(g.voornaam, ' ', g.achternaam) as studentnaam, b.naam as bedrijfsnaam,
                   (SELECT MAX(weeknummer) FROM LOGBOEK_WEEK WHERE stage_id = s.stage_id) as week_nr,
                   (SELECT status FROM LOGBOEK_WEEK WHERE stage_id = s.stage_id ORDER BY weeknummer DESC LIMIT 1) as status,
                   (SELECT mentor_feedback FROM LOGBOEK_WEEK WHERE stage_id = s.stage_id ORDER BY weeknummer DESC LIMIT 1) as mentor_feedback,
                   (SELECT docent_feedback FROM LOGBOEK_WEEK WHERE stage_id = s.stage_id ORDER BY weeknummer DESC LIMIT 1) as docent_feedback
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN DOCENT d ON s.leerkracht_id = d.docent_id
            WHERE sm.gebruiker_id = ? OR d.gebruiker_id = ?
        `, [gebruikerId, gebruikerId]);
        res.json(logboeken);
    } catch (err) {
        console.error('Error fetching all logboeken:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 4. Get open evaluaties for this mentor
exports.getOpenEvaluaties = async (req, res) => {
    try {
        const stages = await vindStagesVoorGebruiker(req.user.id);
        res.json(stages);
    } catch (err) {
        console.error('Error fetching open evaluaties:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 5. Contracten die mentor nog moet tekenen
exports.getContracten = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        const jwt = require('jsonwebtoken');
        const SECRET = process.env.JWT_SECRET;
        if (!SECRET) { console.error('FOUT: JWT_SECRET is niet ingesteld in .env'); }
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        const [rows] = await db.query(`
            SELECT c.contract_id, c.student_getekend, c.mentor_getekend,
                   CONCAT(g.voornaam, ' ', g.achternaam) AS studentnaam,
                   b.naam AS bedrijfsnaam, s.startdatum, s.einddatum
            FROM CONTRACT c
            JOIN STAGE s ON s.stage_id = c.stage_id
            JOIN STUDENT stud ON s.student_id = stud.student_id
            JOIN GEBRUIKER g ON stud.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN DOCENT d ON s.leerkracht_id = d.docent_id
            WHERE (sm.gebruiker_id = ? OR d.gebruiker_id = ?) AND c.docent_getekend = 1
        `, [gebruikerId, gebruikerId]);

        const contracten = rows.map(c => {
            const token = jwt.sign(
                { contractId: c.contract_id, type: 'mentor_sign' },
                SECRET,
                { expiresIn: '48h' }
            );
            return {
                contract_id: c.contract_id,
                studentnaam: c.studentnaam,
                bedrijfsnaam: c.bedrijfsnaam,
                startdatum: c.startdatum,
                einddatum: c.einddatum,
                student_getekend: !!c.student_getekend,
                mentor_getekend: !!c.mentor_getekend,
                teken_url: `${frontendUrl}/mentor_contract.html?token=${token}`
            };
        });

        res.json(contracten);
    } catch (err) {
        console.error('Error fetching contracten:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 6. Mentor/docent geeft feedback op een logboek week
exports.slaLogboekFeedbackOp = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        const { stage_id, weeknummer, feedback } = req.body;

        if (!stage_id || !weeknummer || feedback === undefined) {
            return res.status(400).json({ error: 'stage_id, weeknummer en feedback zijn verplicht' });
        }

        const [check] = await db.query(`
            SELECT lw.week_id FROM LOGBOEK_WEEK lw
            JOIN STAGE s ON lw.stage_id = s.stage_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN DOCENT d ON s.leerkracht_id = d.docent_id
            WHERE lw.stage_id = ? AND lw.weeknummer = ? AND (sm.gebruiker_id = ? OR d.gebruiker_id = ?)
        `, [stage_id, weeknummer, gebruikerId, gebruikerId]);
        if (check.length === 0) return res.status(404).json({ error: 'Logboek niet gevonden of geen toegang' });

        await db.query(
            'UPDATE LOGBOEK_WEEK SET mentor_feedback = ? WHERE stage_id = ? AND weeknummer = ?',
            [feedback, stage_id, weeknummer]
        );

        res.json({ message: 'Feedback opgeslagen' });
    } catch (err) {
        console.error('Error saving mentor feedback:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 7. Mentor/docent keurt logboek goed
exports.keurLogboekGoed = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        const { stage_id, weeknummer } = req.body;

        if (!stage_id || !weeknummer) {
            return res.status(400).json({ error: 'stage_id en weeknummer zijn verplicht' });
        }

        const [check] = await db.query(`
            SELECT lw.week_id FROM LOGBOEK_WEEK lw
            JOIN STAGE s ON lw.stage_id = s.stage_id
            LEFT JOIN STAGEMENTOR sm ON s.mentor_id = sm.mentor_id
            LEFT JOIN DOCENT d ON s.leerkracht_id = d.docent_id
            WHERE lw.stage_id = ? AND lw.weeknummer = ? AND (sm.gebruiker_id = ? OR d.gebruiker_id = ?)
        `, [stage_id, weeknummer, gebruikerId, gebruikerId]);
        if (check.length === 0) return res.status(404).json({ error: 'Logboek niet gevonden of geen toegang' });

        await db.query(
            'UPDATE LOGBOEK_WEEK SET status = \'goedgekeurd\' WHERE stage_id = ? AND weeknummer = ?',
            [stage_id, weeknummer]
        );

        res.json({ message: 'Logboek goedgekeurd' });
    } catch (err) {
        console.error('Error approving logboek:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 8. Mentor slaat per-competentie scores op
exports.slaEvaluatieOp = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        const { stage_id, weeknummer, scores, feedback } = req.body;

        if (!stage_id || !weeknummer || !scores) {
            return res.status(400).json({ error: 'stage_id, weeknummer en scores zijn verplicht' });
        }

        const type = `week${weeknummer}`;
        const [existing] = await db.query(
            'SELECT evaluatie_id FROM EVALUATIE WHERE stage_id = ? AND type = ? AND beoordelaar_id = ?',
            [stage_id, type, gebruikerId]
        );

        let evaluatieId;
        if (existing.length > 0) {
            evaluatieId = existing[0].evaluatie_id;
            await db.query('DELETE FROM EVALUATIE_COMPETENTIE WHERE evaluatie_id = ?', [evaluatieId]);
            if (feedback !== undefined) {
                await db.query('UPDATE EVALUATIE SET feedback = ? WHERE evaluatie_id = ?', [feedback, evaluatieId]);
            }
        } else {
            const [result] = await db.query(
                'INSERT INTO EVALUATIE (stage_id, beoordelaar_id, type, beoordelaar_rol, datum, feedback) VALUES (?, ?, ?, \'mentor\', CURDATE(), ?)',
                [stage_id, gebruikerId, type, feedback || null]
            );
            evaluatieId = result.insertId;
        }

        for (const [competentieId, score] of Object.entries(scores)) {
            await db.query(
                'INSERT INTO EVALUATIE_COMPETENTIE (evaluatie_id, competentie_id, score) VALUES (?, ?, ?)',
                [evaluatieId, competentieId, score]
            );
        }

        res.json({ message: 'Evaluatie opgeslagen', evaluatie_id: evaluatieId });
    } catch (err) {
        console.error('Error saving evaluatie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 9. Haal evaluatie op voor een specifieke week
exports.getEvaluatie = async (req, res) => {
    try {
        const { stage_id, weeknummer } = req.query;
        if (!stage_id || !weeknummer) {
            return res.status(400).json({ error: 'stage_id en weeknummer zijn verplicht' });
        }

        const type = `week${weeknummer}`;
        const [rows] = await db.query(
            `SELECT e.evaluatie_id, e.type, e.feedback, e.beoordelaar_rol,
                    ec.competentie_id, c.naam AS competentie_naam, ec.score
             FROM EVALUATIE e
             JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
             JOIN COMPETENTIE c ON c.competentie_id = ec.competentie_id
             WHERE e.stage_id = ? AND e.type = ?`,
            [stage_id, type]
        );

        res.json(rows);
    } catch (err) {
        console.error('Error fetching evaluatie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
