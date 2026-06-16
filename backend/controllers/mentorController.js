const db = require('../config/db');

// 1. Get all students (stages) assigned to this mentor
exports.getStudenten = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        
        // Find mentor profile
        const [mentors] = await db.query('SELECT * FROM STAGEMENTOR WHERE gebruiker_id = ?', [gebruikerId]);
        if (mentors.length === 0) {
            return res.status(404).json({ error: 'Mentor profiel niet gevonden' });
        }
        const mentorId = mentors[0].mentor_id;

        // Find stages assigned to this mentor
        const query = `
            SELECT s.stage_id, s.status, s.startdatum, s.einddatum, 
                   st.opleiding, 
                   g.naam as studentnaam,
                   b.naam as bedrijfsnaam
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE s.mentor_id = ?
        `;
        const [stages] = await db.query(query, [mentorId]);
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
        
        const query = `
            SELECT lw.week_id, lw.stage_id, lw.weeknummer as week_nr, lw.status, lw.ingediend_op,
                   g.naam as studentnaam, b.naam as bedrijfsnaam
            FROM LOGBOEK_WEEK lw
            JOIN STAGE s ON lw.stage_id = s.stage_id
            JOIN STAGEMENTOR m ON s.mentor_id = m.mentor_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE m.gebruiker_id = ? AND lw.status IN ('pending', 'draft')
        `;
        const [weken] = await db.query(query, [gebruikerId]);
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
        
        // This endpoint returns a list of stages with their pending/latest logboek status
        // so the frontend can group weeks by stage.
        const query = `
            SELECT s.stage_id as logboek_id, s.stage_id,
                   g.naam as studentnaam, b.naam as bedrijfsnaam,
                   (SELECT MAX(weeknummer) FROM LOGBOEK_WEEK WHERE stage_id = s.stage_id) as week_nr,
                   (SELECT status FROM LOGBOEK_WEEK WHERE stage_id = s.stage_id ORDER BY weeknummer DESC LIMIT 1) as status
            FROM STAGE s
            JOIN STAGEMENTOR m ON s.mentor_id = m.mentor_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE m.gebruiker_id = ?
        `;
        const [logboeken] = await db.query(query, [gebruikerId]);
        res.json(logboeken);
    } catch (err) {
        console.error('Error fetching all logboeken:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// 4. Get open evaluaties for this mentor
exports.getOpenEvaluaties = async (req, res) => {
    try {
        const gebruikerId = req.user.id;
        
        // For simplicity, we just return the stages assigned to this mentor
        // The frontend considers an evaluatie "open" if it's not submitted fully yet.
        const query = `
            SELECT s.stage_id, s.status,
                   g.naam as studentnaam, b.naam as bedrijfsnaam
            FROM STAGE s
            JOIN STAGEMENTOR m ON s.mentor_id = m.mentor_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE m.gebruiker_id = ?
        `;
        const [stages] = await db.query(query, [gebruikerId]);
        res.json(stages);
    } catch (err) {
        console.error('Error fetching open evaluaties:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
