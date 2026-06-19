const db = require('../config/db');

// Get all competenties met rubrieken/niveaus
exports.getCompetenties = async (req, res) => {
    try {
        const [competenties] = await db.query('SELECT * FROM COMPETENTIE ORDER BY competentie_id ASC');
        const [rubrieken] = await db.query('SELECT * FROM RUBRIEK ORDER BY competentie_id, punten ASC');
        const result = competenties.map(comp => ({
            ...comp,
            niveaus: rubrieken
                .filter(r => r.competentie_id === comp.competentie_id)
                .map(r => ({
                    score: r.punten,
                    code: r.punten <= 1 ? 'O' : r.punten <= 2 ? 'V' : r.punten <= 3 ? 'G' : 'UG',
                    label: r.punten <= 1 ? 'Onvoldoende' : r.punten <= 2 ? 'Voldoende' : r.punten <= 3 ? 'Goed' : 'Uitstekend',
                    omschrijving: r.omschrijving || ''
                }))
        }));
        res.json(result);
    } catch (err) {
        console.error('Error fetching competenties:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get concept evaluatie for a given stage and type
exports.getConcept = async (req, res) => {
    try {
        const { stage_id, type } = req.query;

        const [evaluaties] = await db.query(
            'SELECT * FROM EVALUATIE WHERE stage_id = ? AND type = ? AND beoordelaar_id = ?',
            [stage_id, type, req.user.id]
        );

        if (evaluaties.length === 0) {
            return res.status(404).json({ error: 'No concept found' });
        }

        const evaluatie_id = evaluaties[0].evaluatie_id;
        const [scores] = await db.query(
            'SELECT competentie_id, score, commentaar as feedback FROM EVALUATIE_COMPETENTIE WHERE evaluatie_id = ?',
            [evaluatie_id]
        );

        res.json({
            evaluatie: evaluaties[0],
            scores: scores
        });
    } catch (err) {
        console.error('Error fetching concept evaluatie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Save evaluatie (concept or final)
exports.saveEvaluatie = async (req, res) => {
    try {
        const { stage_id, type, definitief, scores } = req.body;
        const beoordelaar_id = req.user.id;
        const beoordelaar_rol = req.user.rol;
        const datum = new Date();

        // Check if evaluatie already exists
        const [existing] = await db.query(
            'SELECT * FROM EVALUATIE WHERE stage_id = ? AND type = ? AND beoordelaar_id = ?',
            [stage_id, type, beoordelaar_id]
        );

        let evaluatie_id;
        if (existing.length > 0) {
            evaluatie_id = existing[0].evaluatie_id;
            // update existing
            await db.query(
                'UPDATE EVALUATIE SET datum = ? WHERE evaluatie_id = ?',
                [datum, evaluatie_id]
            );
        } else {
            // insert new
            const [result] = await db.query(
                'INSERT INTO EVALUATIE (stage_id, beoordelaar_id, type, beoordelaar_rol, datum) VALUES (?, ?, ?, ?, ?)',
                [stage_id, beoordelaar_id, type, beoordelaar_rol, datum]
            );
            evaluatie_id = result.insertId;
        }

        // Delete old scores for this evaluatie to replace them
        await db.query('DELETE FROM EVALUATIE_COMPETENTIE WHERE evaluatie_id = ?', [evaluatie_id]);

        // Insert new scores
        if (scores && scores.length > 0) {
            const values = scores.map(s => [evaluatie_id, s.competentie_id, s.score, s.feedback]);
            await db.query(
                'INSERT INTO EVALUATIE_COMPETENTIE (evaluatie_id, competentie_id, score, commentaar) VALUES ?',
                [values]
            );
        }

        res.json({ message: definitief ? 'Evaluatie definitief opgeslagen' : 'Concept opgeslagen' });
    } catch (err) {
        console.error('Error saving evaluatie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
