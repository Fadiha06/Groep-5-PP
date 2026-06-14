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

// POST /api/docent/reminder — stuur een logboek-herinnering naar een student
const stuurReminder = async (req, res) => {
    const { stage_id, weeknummer } = req.body;

    if (!stage_id) {
        return res.status(400).json({ error: 'stage_id is verplicht' });
    }

    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) {
            return res.status(404).json({ error: 'Geen docent gevonden' });
        }

        const stage = await docentModel.getStageInfo(stage_id);
        if (!stage) {
            return res.status(404).json({ error: 'Stage niet gevonden' });
        }

        // Alleen de begeleidende docent mag reminderen
        if (stage.leerkracht_id !== docent.docent_id) {
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        }

        const titel = 'Logboek herinnering';
        const bericht = weeknummer
            ? `Vergeet je logboek van week ${weeknummer} niet in te vullen.`
            : 'Vergeet je logboek niet in te vullen.';

        await docentModel.maakNotificatie(stage.student_gebruiker_id, stage_id, titel, bericht, 'reminder');

        res.status(201).json({ message: `Reminder verstuurd naar ${stage.student_naam}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij versturen reminder' });
    }
};

// GET /api/docent/milestones — contract-status per student
const getMilestones = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) {
            return res.status(404).json({ error: 'Geen docent gevonden' });
        }

        const rijen = await docentModel.getMilestones(docent.docent_id);

        const milestones = rijen.map(r => ({
            stage_id: r.stage_id,
            student: r.student_naam,
            stageovereenkomst: (r.student_getekend && r.mentor_getekend)
                ? 'Stageovereenkomst OK'
                : 'Stageovereenkomst nog niet getekend',
            getekend: !!(r.student_getekend && r.mentor_getekend)
        }));

        res.json({ docent: docent.naam, milestones });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen milestones' });
    }
};
module.exports = { getStudenten, stuurReminder, getMilestones };