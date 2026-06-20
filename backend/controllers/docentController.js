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
            contract_id: r.contract_id || null,
            student: r.student_naam,
            student_getekend: !!r.student_getekend,
            mentor_getekend: !!r.mentor_getekend,
            docent_getekend: !!r.docent_getekend,
            stageovereenkomst: (r.student_getekend && r.mentor_getekend && r.docent_getekend)
                ? 'Volledig getekend'
                : (r.student_getekend && r.mentor_getekend)
                    ? 'Wacht op docent'
                    : 'Nog niet volledig getekend',
            getekend: !!(r.student_getekend && r.mentor_getekend && r.docent_getekend)
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


// GET /api/docenten/logboeken
const getLogboeken = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        const rijen = await docentModel.getLogboeken(docent.docent_id);
        const logboeken = await Promise.all(rijen.map(async (r) => {
            const dagen = await docentModel.getDagenVoorWeek(r.week_id);
            // Voeg competentie-scores toe per dag
            const dagenMetCompetenties = await Promise.all(dagen.map(async (d) => {
                const competenties = await docentModel.getCompetentiesVoorDag(d.dag_id);
                return { ...d, competenties };
            }));
            return { ...r, dagen: dagenMetCompetenties };
        }));
        res.json(logboeken);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen logboeken' });
    }
};

// POST /api/docenten/logboek/goedkeuren
const goedkeurLogboek = async (req, res) => {
    const { stage_id, week } = req.body;
    if (!stage_id || !week) return res.status(400).json({ error: 'stage_id en week zijn verplicht' });
    try {
        const db = require('../config/db');
        const [rows] = await db.query('SELECT week_id FROM LOGBOEK_WEEK WHERE stage_id = ? AND weeknummer = ?', [stage_id, week]);
        if (!rows[0]) return res.status(404).json({ error: 'Logboek niet gevonden' });
        await docentModel.goedkeurLogboek(rows[0].week_id);
        res.json({ message: 'Logboek goedgekeurd' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij goedkeuren' });
    }
};

// POST /api/docenten/logboek/feedback
const geefLogboekFeedback = async (req, res) => {
    const { stage_id, week, feedback } = req.body;
    if (!stage_id || !week || !feedback) return res.status(400).json({ error: 'stage_id, week en feedback zijn verplicht' });
    try {
        const db = require('../config/db');
        const [rows] = await db.query('SELECT week_id FROM LOGBOEK_WEEK WHERE stage_id = ? AND weeknummer = ?', [stage_id, week]);
        if (!rows[0]) return res.status(404).json({ error: 'Logboek niet gevonden' });
        await docentModel.slaFeedbackOp(rows[0].week_id, feedback);
        res.json({ message: 'Feedback opgeslagen' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij feedback' });
    }
};

// GET /api/docenten/evaluatie-studenten
const getEvaluatieStudenten = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        const studenten = await docentModel.getEvaluatieStudenten(docent.docent_id);
        res.json(studenten);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen studenten' });
    }
};

// GET /api/docenten/evaluatie?stage_id=&week=
const getEvaluatie = async (req, res) => {
    const { stage_id, week } = req.query;
    if (!stage_id || !week) return res.status(400).json({ error: 'stage_id en week zijn verplicht' });
    try {
        const rijen = await docentModel.getEvaluaties(stage_id, week);
        res.json(rijen);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen evaluatie' });
    }
};

// GET /api/docent/evaluatie-vergelijking?stage_id=X&type=tussentijds
const getEvaluatieVergelijking = async (req, res) => {
    const { stage_id, type } = req.query;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is verplicht' });
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(docent.docent_id, stage_id))) {
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        }
        const data = await docentModel.getEvaluatieVergelijking(stage_id, type || 'tussentijds');
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen vergelijking' });
    }
};

// GET /api/docent/evaluatie-planning?stage_id=X
const getEvaluatiePlanning = async (req, res) => {
    const { stage_id } = req.query;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is verplicht' });
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(docent.docent_id, stage_id))) {
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        }
        const planning = await docentModel.getEvaluatiePlanning(stage_id);
        res.json(planning);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen planning' });
    }
};

// PUT /api/docent/evaluatie-planning
const setEvaluatiePlanning = async (req, res) => {
    const { stage_id, tussentijds_vanaf, finaal_vanaf } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is verplicht' });
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(docent.docent_id, stage_id))) {
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        }
        await docentModel.setEvaluatiePlanning(stage_id, tussentijds_vanaf, finaal_vanaf);
        res.json({ message: 'Evaluatieplanning opgeslagen' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij opslaan planning' });
    }
};

// POST /api/docenten/evaluatie/opslaan
const slaEvaluatieOp = async (req, res) => {
    const { stage_id, week, scores } = req.body;
    if (!stage_id || !week || !scores) return res.status(400).json({ error: 'stage_id, week en scores zijn verplicht' });
    try {
        await docentModel.slaEvaluatieOp(stage_id, week, req.user.id, scores);
        res.json({ message: 'Evaluatie opgeslagen' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij opslaan evaluatie' });
    }
};

// GET /api/docenten/logboek/evaluatie?stage_id=&week= — haal per-competentie scores van de mentor op (read-only voor docent)
const getLogboekEvaluatie = async (req, res) => {
    const { stage_id, week } = req.query;
    if (!stage_id || !week) return res.status(400).json({ error: 'stage_id en week zijn verplicht' });
    try {
        const type = `week${week}`;
        const [rows] = await require('../config/db').query(
            `SELECT e.evaluatie_id, e.feedback, e.beoordelaar_rol,
                    ec.competentie_id, c.naam AS competentie_naam, ec.score
             FROM EVALUATIE e
             JOIN EVALUATIE_COMPETENTIE ec ON ec.evaluatie_id = e.evaluatie_id
             JOIN COMPETENTIE c ON c.competentie_id = ec.competentie_id
             WHERE e.stage_id = ? AND e.type = ? AND e.beoordelaar_rol = 'mentor'`,
            [stage_id, type]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen logboek evaluatie' });
    }
};

module.exports = { 
  getStudenten, 
  stuurReminder, 
  getMilestones, 
  getDossiers, 
  getMeldingen, 
  getLogboeken, 
  goedkeurLogboek, 
  geefLogboekFeedback, 
  getEvaluatieStudenten, 
  getEvaluatie, 
  slaEvaluatieOp, 
  getLogboekEvaluatie, 
  getEvaluatieVergelijking, 
  getEvaluatiePlanning, 
  setEvaluatiePlanning 
};