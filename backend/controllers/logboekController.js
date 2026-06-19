const db = require('../config/db');

exports.getLogboekWeken = async (req, res) => {
    try {
        const { logId } = req.params; // this is stage_id

        // Fetch weken with all feedback columns
        const [weken] = await db.query(
            'SELECT week_id, stage_id, weeknummer, ingediend_op, totaal_uren, status, mentor_feedback, docent_feedback, docent_goedgekeurd FROM LOGBOEK_WEEK WHERE stage_id = ? ORDER BY weeknummer ASC',
            [logId]
        );
        
        // Fetch dagen for these weken
        const [dagen] = await db.query('SELECT * FROM LOGBOEK_DAG WHERE stage_id = ? ORDER BY datum ASC', [logId]);

        // Fetch competenties per dag
        const [alleCompetenties] = await db.query(
            `SELECT lc.dag_id, lc.competentie_id, c.naam, lc.score, lc.commentaar
             FROM LOGBOEK_COMPETENTIE lc
             JOIN COMPETENTIE c ON c.competentie_id = lc.competentie_id
             WHERE lc.dag_id IN (SELECT dag_id FROM LOGBOEK_DAG WHERE stage_id = ?)`,
            [logId]
        );

        // Fetch evaluaties per week
        const [evaluaties] = await db.query(
            `SELECT e.stage_id, e.type, e.feedback, e.beoordelaar_rol,
                    ec.competentie_id, c.naam AS competentie_naam, ec.score
             FROM EVALUATIE e
             JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
             JOIN COMPETENTIE c ON c.competentie_id = ec.competentie_id
             WHERE e.stage_id = ? AND e.type LIKE 'week%'`,
            [logId]
        );

        // Group dagen by week and attach competenties
        const wekenMetDagen = weken.map(w => {
            const weekDagen = dagen
                .filter(d => d.week_id === w.week_id)
                .map(d => ({
                    ...d,
                    competenties: alleCompetenties.filter(c => c.dag_id === d.dag_id)
                }));
            
            // Group evaluaties by type (weekN)
            const weekEvaluaties = evaluaties.filter(e => e.type === `week${w.weeknummer}`);
            const docentScores = weekEvaluaties.filter(e => e.beoordelaar_rol === 'docent');
            const mentorScores = weekEvaluaties.filter(e => e.beoordelaar_rol === 'mentor');

            return {
                ...w,
                dagen: weekDagen,
                docent_scores: docentScores,
                mentor_scores: mentorScores
            };
        });

        res.json(wekenMetDagen);
    } catch (err) {
        console.error('Error fetching logboek weken:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.saveFeedback = async (req, res) => {
    try {
        const { logId } = req.params;
        const { week_nr, mentor_feedback, status } = req.body;

        await db.query(
            'UPDATE LOGBOEK_WEEK SET mentor_feedback = ?, status = ? WHERE stage_id = ? AND weeknummer = ?',
            [mentor_feedback, status || 'draft', logId, week_nr]
        );

        res.json({ message: 'Feedback saved' });
    } catch (err) {
        console.error('Error saving feedback:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.approveLogboek = async (req, res) => {
    try {
        const { logId } = req.params;
        const { week_nr, mentor_feedback } = req.body;

        await db.query(
            'UPDATE LOGBOEK_WEEK SET mentor_feedback = ?, status = ? WHERE stage_id = ? AND weeknummer = ?',
            [mentor_feedback, 'goedgekeurd', logId, week_nr]
        );

        res.json({ message: 'Logboek approved' });
    } catch (err) {
        console.error('Error approving logboek:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
