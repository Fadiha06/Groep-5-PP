const docentModel = require('../models/docentModel');

// GET /api/docent/studenten?week=4 — lijst voor "Logboek Controle"
const getStudenten = async (req, res) => {
    const weeknummer = Number(req.query.week) || 1;

    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) {
            return res.status(404).json({ error: 'Geen docent gevonden' });
        }

        const rijen = await docentModel.getStudentenMetLogboekStatus(docent.docent_id, weeknummer);

        // NULL-status netjes omzetten naar "Ontbreekt" voor de frontend
        const studenten = rijen.map(r => ({
            stage_id: r.stage_id,
            student: r.student_naam,
            bedrijf: r.bedrijf_naam || '—',
            status: r.logboek_status
                ? `Ingediend (${r.totaal_uren ?? 0}u)`
                : 'Ontbreekt',
            ingevuld: r.logboek_status !== null
        }));

        res.json({
            docent: docent.naam,
            weeknummer,
            studenten
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen studenten' });
    }
};

module.exports = { getStudenten };