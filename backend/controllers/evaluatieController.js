const db = require('../config/db');

// Get all competenties
exports.getCompetenties = async (req, res) => {
    try {
        const [comps] = await db.query(
            'SELECT competentie_id, naam, omschrijving FROM COMPETENTIE ORDER BY naam ASC'
        );
        const [niveaus] = await db.query(
            'SELECT competentie_id, punten, omschrijving FROM RUBRIEK ORDER BY punten ASC'
        );
        const result = comps.map(c => ({
            ...c,
            niveaus: niveaus
                .filter(n => n.competentie_id === c.competentie_id)
                .map(n => ({ punten: n.punten, omschrijving: n.omschrijving }))
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
        const isDefinitief = definitief ? 1 : 0;

        // Finale evaluatie pas toegestaan nadat de stage is afgelopen
        if (type === 'finaal') {
            const [st] = await db.query('SELECT einddatum FROM STAGE WHERE stage_id = ?', [stage_id]);
            if (st.length && st[0].einddatum && new Date(st[0].einddatum) > new Date()) {
                return res.status(403).json({ error: 'De finale evaluatie kan pas ingevuld worden nadat de stage is afgelopen.' });
            }
        }

        const [existing] = await db.query(
            'SELECT evaluatie_id, definitief FROM EVALUATIE WHERE stage_id = ? AND type = ? AND beoordelaar_id = ?',
            [stage_id, type, beoordelaar_id]
        );

        if (existing.length > 0 && existing[0].definitief === 1) {
            return res.status(409).json({ error: 'Deze evaluatie is al definitief ingediend en kan niet meer gewijzigd worden.' });
        }

        let evaluatie_id;
        if (existing.length > 0) {
            evaluatie_id = existing[0].evaluatie_id;
            await db.query(
                'UPDATE EVALUATIE SET datum = ?, definitief = ? WHERE evaluatie_id = ?',
                [datum, isDefinitief, evaluatie_id]
            );
        } else {
            const [result] = await db.query(
                'INSERT INTO EVALUATIE (stage_id, beoordelaar_id, type, beoordelaar_rol, datum, definitief) VALUES (?, ?, ?, ?, ?, ?)',
                [stage_id, beoordelaar_id, type, beoordelaar_rol, datum, isDefinitief]
            );
            evaluatie_id = result.insertId;
        }

        await db.query('DELETE FROM EVALUATIE_COMPETENTIE WHERE evaluatie_id = ?', [evaluatie_id]);
        if (scores && scores.length > 0) {
            const values = scores.map(s => [evaluatie_id, s.competentie_id, s.score, s.feedback]);
            await db.query(
                'INSERT INTO EVALUATIE_COMPETENTIE (evaluatie_id, competentie_id, score, commentaar) VALUES ?',
                [values]
            );
        }

        res.json({ message: isDefinitief ? 'Evaluatie definitief opgeslagen' : 'Concept opgeslagen' });
    } catch (err) {
        console.error('Error saving evaluatie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};