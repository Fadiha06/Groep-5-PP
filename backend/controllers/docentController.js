const docentModel = require('../models/docentModel');

// GET /api/docent/studenten?week=4 — lijst voor "Logboek Controle"
const getStudenten = async (req, res) => {
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) {
            return res.status(404).json({ error: 'Geen docent gevonden' });
        }

        const db = require('../config/db');
        const [wRows] = await db.query('SELECT MAX(weeknummer) as w FROM LOGBOEK_WEEK lw JOIN STAGE st ON st.stage_id = lw.stage_id WHERE st.leerkracht_id = ?', [docent.docent_id]);
        const weeknummer = Number(req.query.week) || wRows[0].w || 1;

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

// GET /api/docenten/evaluatie?stage_id=&type=
const getEvaluatie = async (req, res) => {
    const { stage_id, type } = req.query;
    if (!stage_id || !type) return res.status(400).json({ error: 'stage_id en type zijn verplicht' });
    try {
        const db = require('../config/db');

        const [stageOpleiding] = await db.query(
            `SELECT s.opleiding FROM STUDENT s JOIN STAGE st ON st.student_id = s.student_id WHERE st.stage_id = ?`, [stage_id]
        );
        const opleiding = stageOpleiding.length > 0 && stageOpleiding[0].opleiding ? stageOpleiding[0].opleiding : null;

        let compQuery = 'SELECT * FROM COMPETENTIE';
        let compParams = [];
        if (opleiding) {
            compQuery += ' WHERE opleiding = ?';
            compParams.push(opleiding);
        }
        compQuery += ' ORDER BY competentie_id ASC';

        const [competenties] = await db.query(compQuery, compParams);
        const [rubrieken] = await db.query('SELECT * FROM RUBRIEK ORDER BY competentie_id, punten ASC');
        const [evaluaties] = await db.query('SELECT e.evaluatie_id, e.beoordelaar_rol, ec.competentie_id, ec.score, ec.commentaar FROM EVALUATIE e JOIN EVALUATIE_COMPETENTIE ec ON e.evaluatie_id = ec.evaluatie_id WHERE e.stage_id = ? AND e.type = ?', [stage_id, type]);

       // Fallback: bereken logboek student gemiddelde als student niet ge�valueerd heeft
        const [logboekAvg] = await db.query(`
            SELECT competentie_id, ROUND(AVG(score)) as avg_score 
            FROM LOGBOEK_COMPETENTIE 
            WHERE student_id = (SELECT student_id FROM STAGE WHERE stage_id = ?)
            GROUP BY competentie_id
        `, [stage_id]);

        // Fallback: bereken wekelijks mentor gemiddelde als mentor niet expliciet 'tussentijds' of 'finaal' indient
        const [mentorAvg] = await db.query(`
            SELECT ec.competentie_id, ROUND(AVG(ec.score)) as avg_score 
            FROM EVALUATIE e 
            JOIN EVALUATIE_COMPETENTIE ec ON e.evaluatie_id = ec.evaluatie_id 
            WHERE e.stage_id = ? AND e.beoordelaar_rol = 'mentor'
            GROUP BY ec.competentie_id
        `, [stage_id]);

        const result = competenties.map(c => {
            const evals = evaluaties.filter(e => e.competentie_id === c.competentie_id);
            const studentEval = evals.find(e => e.beoordelaar_rol === 'student');
            const mentorEval = evals.find(e => e.beoordelaar_rol === 'mentor' || e.beoordelaar_rol === 'stagementor');
            const docentEval = evals.find(e => e.beoordelaar_rol === 'docent') || {};
            
            // Gebruik expliciete student evaluatie OF fallback naar logboek gemiddelde
            let s_score = studentEval ? studentEval.score : null;
            if (s_score === null) {
                const fallback = logboekAvg.find(l => l.competentie_id === c.competentie_id);
                if (fallback) s_score = parseInt(fallback.avg_score);
            }

            // Gebruik expliciete mentor evaluatie OF fallback naar wekelijks mentor gemiddelde
            let m_score = mentorEval ? mentorEval.score : null;
            if (m_score === null) {
                const m_fallback = mentorAvg.find(l => l.competentie_id === c.competentie_id);
                if (m_fallback) m_score = parseInt(m_fallback.avg_score);
            }

            return {
                competentie_id: c.competentie_id,
                naam: c.naam,
                domeinen: c.opleiding, // Using opleiding as domein
                opties: rubrieken.filter(r => r.competentie_id === c.competentie_id).map(r => ({
                    score: r.punten,
                    label: r.punten <= 1 ? 'Onvoldoende' : r.punten <= 2 ? 'Voldoende' : r.punten <= 3 ? 'Goed' : 'Uitstekend',
                    beschrijving: r.omschrijving || ''
                })),
                score_student: s_score,
                score_mentor: m_score,
                score_docent: docentEval.score || null,
                feedback_student: studentEval ? (studentEval.commentaar || '') : '',
                feedback_mentor: mentorEval ? (mentorEval.commentaar || '') : ''
            };
        });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen evaluatie' });
    }
};

// POST /api/docenten/evaluatie/opslaan
const slaEvaluatieOp = async (req, res) => {
    const { stage_id, type, scores } = req.body;
    if (!stage_id || !type || !scores) return res.status(400).json({ error: 'stage_id, type en scores zijn verplicht' });
    try {
        const db = require('../config/db');
        const [existing] = await db.query('SELECT evaluatie_id FROM EVALUATIE WHERE stage_id = ? AND type = ? AND beoordelaar_id = ?', [stage_id, type, req.user.id]);
        let evaluatieId;
        if (existing.length > 0) {
            evaluatieId = existing[0].evaluatie_id;
            await db.query('DELETE FROM EVALUATIE_COMPETENTIE WHERE evaluatie_id = ?', [evaluatieId]);
        } else {
            const [result] = await db.query('INSERT INTO EVALUATIE (stage_id, beoordelaar_id, type, beoordelaar_rol, datum) VALUES (?, ?, ?, ?, CURDATE())', [stage_id, req.user.id, type, 'docent']);
            evaluatieId = result.insertId;
        }
        if (scores && scores.length > 0) {
            const values = scores.map(s => [evaluatieId, s.competentie_id, s.score, s.commentaar || null]);
            await db.query('INSERT INTO EVALUATIE_COMPETENTIE (evaluatie_id, competentie_id, score, commentaar) VALUES ?', [values]);
        }
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

const getAggregatie = async (req, res) => {
    try {
        const rows = await docentModel.getAggregatie(req.user.id);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen aggregatie' });
    }
};

// GET /api/docent/evaluatie-vergelijking?stage_id=X&type=tussentijds
const getEvaluatieVergelijking = async (req, res) => {
    const { stage_id, type } = req.query;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is verplicht' });
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(stage_id, req.user.id))) {
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
        if (!(await docentModel.isEigenStage(stage_id, req.user.id))) {
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
        if (!(await docentModel.isEigenStage(stage_id, req.user.id))) {
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        }
        await docentModel.setEvaluatiePlanning(stage_id, tussentijds_vanaf, finaal_vanaf);
        res.json({ message: 'Evaluatieplanning opgeslagen' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij opslaan planning' });
    }
};
// POST /api/docent/evaluatie/toon — toon/verberg evaluatie aan student
const toggleEvaluatieGetoond = async (req, res) => {
    const { stage_id, type } = req.body;
    if (!stage_id || !type) return res.status(400).json({ error: 'stage_id en type zijn verplicht' });
    if (!['tussentijds', 'finaal'].includes(type)) return res.status(400).json({ error: 'type moet tussentijds of finaal zijn' });
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(stage_id, req.user.id))) {
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        }

        const db = require('../config/db');
        const kolom = type === 'tussentijds' ? 'eval_getoond_tussentijds' : 'eval_getoond_finaal';

        const [rows] = await db.query(`SELECT ${kolom} AS huidig FROM STAGE WHERE stage_id = ?`, [stage_id]);
        const nieuw = rows[0] ? !rows[0].huidig : false;
        await db.query(`UPDATE STAGE SET ${kolom} = ? WHERE stage_id = ?`, [nieuw ? 1 : 0, stage_id]);

        res.json({ message: nieuw ? 'Evaluatie getoond aan student' : 'Evaluatie verborgen voor student', getoond: nieuw });
    } catch (err) {
        console.error('Error toggling evaluatie visibility:', err);
        res.status(500).json({ error: 'Serverfout bij wijzigen zichtbaarheid' });
    }
};

// GET /api/docent/evaluatie/logboek-per-week?stage_id=X&week=Y
const getLogboekPerWeek = async (req, res) => {
    const { stage_id, week } = req.query;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is verplicht' });
    try {
        const docent = await docentModel.getDocent(req.user.id);
        if (!docent) return res.status(404).json({ error: 'Geen docent gevonden' });
        if (!(await docentModel.isEigenStage(stage_id, req.user.id))) {
            return res.status(403).json({ error: 'Dit is niet jouw student' });
        }

        const db = require('../config/db');

        const [weken] = await db.query(
            'SELECT week_id, weeknummer, mentor_feedback FROM LOGBOEK_WEEK WHERE stage_id = ? ORDER BY weeknummer ASC',
            [stage_id]
        );

        if (weken.length === 0) {
            return res.json({ weken: [], competenties: [], scores: {} });
        }

        if (week) {
            const selectedWeek = weken.find(w => w.weeknummer === Number(week));
            if (!selectedWeek) {
                return res.json({ weken: weken.map(w => w.weeknummer), competenties: [], scores: {}, mentor_feedback: null });
            }

            const [dagen] = await db.query(
                'SELECT dag_id FROM LOGBOEK_DAG WHERE week_id = ?',
                [selectedWeek.week_id]
            );

            if (dagen.length === 0) {
                return res.json({ weken: weken.map(w => w.weeknummer), competenties: [], scores: {}, mentor_feedback: selectedWeek.mentor_feedback || null });
            }

            const dagIds = dagen.map(d => d.dag_id);
            const dagPlaceholders = dagIds.map(() => '?').join(',');

            const [competenties] = await db.query(
                `SELECT DISTINCT c.competentie_id, c.naam
                 FROM LOGBOEK_COMPETENTIE lc
                 JOIN COMPETENTIE c ON c.competentie_id = lc.competentie_id
                 WHERE lc.dag_id IN (${dagPlaceholders})`,
                dagIds
            );

            const [scores] = await db.query(
                `SELECT lc.competentie_id, ROUND(AVG(lc.score)) AS avg_score
                 FROM LOGBOEK_COMPETENTIE lc
                 WHERE lc.dag_id IN (${dagPlaceholders})
                 GROUP BY lc.competentie_id`,
                dagIds
            );

            const gemiddelden = {};
            competenties.forEach(c => {
                const avg = scores.find(s => s.competentie_id === c.competentie_id);
                if (avg) gemiddelden[c.competentie_id] = parseInt(avg.avg_score);
            });

            return res.json({
                weken: weken.map(w => w.weeknummer),
                competenties: competenties.map(c => ({ id: c.competentie_id, naam: c.naam })),
                scores: gemiddelden,
                mentor_feedback: selectedWeek.mentor_feedback || null
            });
        }

        res.json({ weken: weken.map(w => w.weeknummer), competenties: [], scores: {} });
    } catch (err) {
        console.error('Error fetching logboek per week:', err);
        res.status(500).json({ error: 'Serverfout bij ophalen logboek per week' });
    }
};

module.exports = { getEvaluatieVergelijking, getEvaluatiePlanning, setEvaluatiePlanning, getStudenten, stuurReminder, getMilestones, getDossiers, getMeldingen, getLogboeken, goedkeurLogboek, geefLogboekFeedback, getEvaluatieStudenten, getEvaluatie, slaEvaluatieOp,
    getAggregatie, getLogboekEvaluatie, toggleEvaluatieGetoond, getLogboekPerWeek };





