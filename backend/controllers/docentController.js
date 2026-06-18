const docentModel = require('../models/docentModel');

// GET /api/docent/studenten — actieve stages + status logboekweek van nu
const getStudenten = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) {
            return res.status(404).json({ error: 'Geen docent gevonden' });
        }

        const rijen = await docentModel.getActieveStagesMetLogboek(docent.docent_id);
        const ingediendeStatussen = ['ingediend', 'goedgekeurd', 'te-laat', 'feedback'];

        const studenten = rijen.map(r => {
            const ingediend = r.logboek_status !== null && ingediendeStatussen.includes(r.logboek_status);
            return {
                stage_id: r.stage_id,
                student: r.student_naam,
                bedrijf: r.bedrijf_naam || '—',
                week: r.huidige_week,
                status: ingediend ? `Ingediend (${r.totaal_uren ?? 0}u)` : 'Nog niet ingediend',
                ingevuld: ingediend
            };
        });

        res.json({ docent: docent.naam, studenten });
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

// GET /api/docent/dossiers — alle studenten met volledige info
const getDossiers = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) {
            return res.status(404).json({ error: 'Geen docent gevonden' });
        }
        const studenten = await docentModel.getDossiers(docent.docent_id);
        res.json({ docent: docent.naam, studenten });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen dossiers' });
    }
};

// GET /api/docent/student/:gebruikerId/meldingen
const getMeldingen = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) {
            return res.status(404).json({ error: 'Geen docent gevonden' });
        }
        
        const dossiers = await docentModel.getDossiers(docent.docent_id);
        const hasAccess = dossiers.some(d => String(d.gebruiker_id) === String(req.params.gebruikerId));
        if (!hasAccess) {
            return res.status(403).json({ error: 'Niet bevoegd om deze meldingen te bekijken' });
        }

        const meldingen = await docentModel.getMeldingenVoorStudent(req.params.gebruikerId);
        res.json({ meldingen });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen meldingen' });
    }
};

// GET /api/docent/logboeken
const getLogboeken = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        const logboeken = await docentModel.getLogboekenVoorDocent(docent.docent_id);
        res.json(logboeken);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen logboeken' });
    }
};

// POST /api/docent/logboek/goedkeuren
const keurLogboekGoed = async (req, res) => {
    const { stage_id, week } = req.body;
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(docent.docent_id, stage_id)))
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        await docentModel.keurLogboekWeekGoed(stage_id, week);
        res.json({ message: 'Logboek goedgekeurd' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij goedkeuren' });
    }
};

// POST /api/docent/logboek/feedback
const geefLogboekFeedback = async (req, res) => {
    const { stage_id, week, feedback } = req.body;
    if (!feedback) return res.status(400).json({ error: 'Feedback ontbreekt' });
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(docent.docent_id, stage_id)))
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        await docentModel.geefLogboekWeekFeedback(stage_id, week, feedback);
        res.json({ message: 'Feedback verstuurd' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij feedback' });
    }
};

// GET /api/docent/todos
const getTodos = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        const todos = await docentModel.getTodos(docent.docent_id);
        res.json(todos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen todos' });
    }
};

// GET /api/docent/punten
const getPunten = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        const punten = await docentModel.getPuntenAggregatie(docent.docent_id);
        res.json({ punten });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen punten' });
    }
};

module.exports = { getStudenten, stuurReminder, getMilestones, getDossiers, getMeldingen, getLogboeken, keurLogboekGoed, geefLogboekFeedback, getTodos, getPunten };