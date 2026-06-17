const db = require('../config/db');

exports.getLogboekWeken = async (req, res) => {
    try {
        const { logId } = req.params; // this is stage_id

        // Fetch weken
        const [weken] = await db.query('SELECT * FROM LOGBOEK_WEEK WHERE stage_id = ? ORDER BY weeknummer ASC', [logId]);
        
        // Fetch dagen for these weken
        const [dagen] = await db.query('SELECT * FROM LOGBOEK_DAG WHERE stage_id = ? ORDER BY datum ASC', [logId]);

        // Group dagen by week
        const wekenMetDagen = weken.map(w => {
            return {
                ...w,
                dagen: dagen.filter(d => d.week_id === w.week_id)
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
            [mentor_feedback, 'approved', logId, week_nr]
        );

        res.json({ message: 'Logboek approved' });
    } catch (err) {
        console.error('Error approving logboek:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
