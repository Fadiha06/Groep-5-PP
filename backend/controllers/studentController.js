const StudentModel = require('../models/studentModel');

// Hulpfunctie: in welke week van de stage valt deze datum?
const berekenWeeknummer = (datum, startdatum) => {
    const start = new Date(startdatum);
    const dag = new Date(datum);
    const verschilInDagen = Math.floor((dag - start) / (1000 * 60 * 60 * 24));
    return Math.floor(verschilInDagen / 7) + 1;
};

class StudentController {

    // ===== Bestaande methods van main — NIET verwijderen =====
    static async getDashboard(req, res) {
        try {
            const gebruikerId = req.user.id;
            const student = await StudentModel.getStudentByGebruikerId(gebruikerId);
            if (!student) return res.status(404).json({ error: 'Studentprofiel niet gevonden' });
            const [stats, stageproces, logboek, notificaties] = await Promise.all([
                StudentModel.getDashboardStats(student.student_id),
                StudentModel.getStageproces(student.student_id),
                StudentModel.getLogboekDezeWeek(student.student_id),
                StudentModel.getNotificaties(gebruikerId)
            ]);
            res.json({ student, stats, stageproces, logboekDezeWeek: logboek, notificaties });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen dashboard' });
        }
    }

    static async getLogboek(req, res) {
        try {
            const gebruikerId = req.user.id;

            const student = await StudentModel.getStudentByGebruikerId(gebruikerId);
            if (!student) {
                return res.status(404).json({ error: 'Studentprofiel niet gevonden' });
            }

            const [stageInfo, laasteDag] = await Promise.all([
                StudentModel.getLogboekStageInfo(student.student_id),
                StudentModel.getLaatsteLogboekDag(student.student_id)
            ]);

            res.json({ stageInfo, laasteDag });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen logboek' });
        }
    }

    static async saveLogboekDag(req, res) {
        const { datum, taken_beschrijving, reflectie, leerpunten, uren } = req.body;

        if (!datum || !taken_beschrijving) {
            return res.status(400).json({ error: 'Datum en taken zijn verplicht' });
        }

        try {
            const result = await StudentModel.saveLogboekDag(
                req.user.id, datum, taken_beschrijving, reflectie, leerpunten, uren
            );

            if (!result) {
                return res.status(404).json({ error: 'Geen student of stage gevonden' });
            }

            res.status(result.actie === 'aangemaakt' ? 201 : 200).json({
                message: `Logboek dag ${result.actie}`,
                dag_id: result.dag_id,
                weeknummer: result.weeknummer
            });

        } catch (err) {
            if (err.message === 'WEEK_INGEDIEND') {
                return res.status(403).json({ error: 'Deze week is al ingediend en kan niet meer bewerkt worden' });
            }
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij opslaan logboek' });
        }
    }

    static async getEvaluaties(req, res) {
        try {
            const gebruikerId = req.user.id;

            const student = await StudentModel.getStudentByGebruikerId(gebruikerId);
            if (!student) {
                return res.status(404).json({ error: 'Studentprofiel niet gevonden' });
            }

            const [tussentijds, finaal] = await Promise.all([
                StudentModel.getTussentijdseEvaluatie(student.student_id),
                StudentModel.getFinaleEvaluatie(student.student_id)
            ]);
            res.json({ tussentijds, finaal });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen evaluaties' });
        }
    }

    // ===== Logboek-feature (jouw werk, nu als static methods) =====
    static async vulDagIn(req, res) {
        const { datum, taken_beschrijving, competenties } = req.body;
        const uren = req.body.uren ?? null;
        const reflectie = req.body.reflectie ?? null;
        const leerpunten = req.body.leerpunten ?? null;
        if (!datum || !taken_beschrijving) return res.status(400).json({ error: 'Datum en taken zijn verplicht' });
        try {
            const info = await StudentModel.getStudentMetStage(req.user.id);
            if (!info) return res.status(404).json({ error: 'Geen student of stage gevonden' });

            const weeknummer = berekenWeeknummer(datum, info.startdatum);
            if (weeknummer < 1) return res.status(400).json({ error: 'Datum valt vóór de start van de stage' });
            const eindStr = info.einddatum instanceof Date ? info.einddatum.toISOString().split('T')[0] : String(info.einddatum).split('T')[0];
            if (info.einddatum && datum > eindStr) {
                return res.status(400).json({ error: 'Datum valt ná het einde van de stage' });
            }

            let week = await StudentModel.findWeek(info.stage_id, weeknummer);
            if (week && week.status === 'ingediend') {
                return res.status(403).json({ error: 'Deze week is al ingediend en kan niet meer bewerkt worden' });
            }
            const weekId = week ? week.week_id : await StudentModel.createWeek(info.stage_id, weeknummer);

            const bestaandeDag = await StudentModel.findDag(info.stage_id, datum);
            let dagId, nieuw;
            if (bestaandeDag) {
                await StudentModel.updateDag(bestaandeDag.dag_id, uren, taken_beschrijving, reflectie, leerpunten);
                dagId = bestaandeDag.dag_id; nieuw = false;
            } else {
                dagId = await StudentModel.createDag(weekId, info.stage_id, datum, uren, taken_beschrijving, reflectie, leerpunten);
                nieuw = true;
            }

            if (Array.isArray(competenties)) {
                await StudentModel.slaCompetentiesOp(dagId, info.student_id, competenties);
            }

            return res.status(nieuw ? 201 : 200).json({ message: nieuw ? 'Dag toegevoegd' : 'Dag bijgewerkt', dag_id: dagId, weeknummer });
        } catch (err) {
            console.error('[vulDagIn]', err.message, err.code);
            res.status(500).json({ error: 'Serverfout bij invullen logboek', detail: err.message });
        }
    }

    static async getWeek(req, res) {
        const weeknummer = Number(req.params.nr);
        try {
            const info = await StudentModel.getStudentMetStage(req.user.id);
            if (!info) return res.status(404).json({ error: 'Geen student of stage gevonden' });
            const week = await StudentModel.findWeek(info.stage_id, weeknummer);
            if (!week) return res.status(404).json({ error: 'Deze week bestaat nog niet' });
            const dagen = await StudentModel.getDagenVanWeek(week.week_id);
            res.json({
                weeknummer: week.weeknummer,
                status: week.status,
                ingediend_op: week.ingediend_op,
                mentor_feedback: week.mentor_feedback || null,
                docent_feedback: week.docent_feedback || null,
                docent_goedgekeurd: week.docent_goedgekeurd || false,
                dagen
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen week' });
        }
    }

    static async dienWeekIn(req, res) {
        const weeknummer = Number(req.params.nr);
        try {
            const info = await StudentModel.getStudentMetStage(req.user.id);
            if (!info) return res.status(404).json({ error: 'Geen student of stage gevonden' });
            const week = await StudentModel.findWeek(info.stage_id, weeknummer);
            if (!week) return res.status(404).json({ error: 'Deze week bestaat nog niet' });
            if (week.status === 'ingediend' || week.status === 'goedgekeurd') return res.status(409).json({ error: 'Deze week is al ingediend' });
            await StudentModel.dienWeekIn(week.week_id);
            res.json({ message: `Week ${weeknummer} ingediend` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij indienen week' });
        }
    }

    static async getLaatste(req, res) {
        try {
            const dag = await StudentModel.getLaatsteDag(req.user.id);
            if (!dag) return res.status(404).json({ error: 'Nog geen logboek ingevuld' });
            dag.competenties = await StudentModel.getCompetentiesVanDag(dag.dag_id);
            res.json(dag);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen laatste logboek' });
        }
    }

    static async getStageInfo(req, res) {
        try {
            const stage = await StudentModel.getStageHeader(req.user.id);
            if (!stage) return res.status(404).json({ error: 'Geen stage gevonden' });
            res.json(stage);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen stage-info' });
        }
    }

    static async getCompetenties(req, res) {
        try {
            const lijst = await StudentModel.getAlleCompetenties();
            res.json(lijst);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen competenties' });
        }
    }

    static async getDagCompetenties(req, res) {
        const dagId = Number(req.params.dagId);
        try {
            const lijst = await StudentModel.getCompetentiesVanDag(dagId);
            res.json(lijst);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen dag-competenties' });
        }
    }

    static async getProfiel(req, res) {
        try {
            const gebruiker = await StudentModel.getGebruiker(req.user.id);
            if (!gebruiker) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
            res.json(gebruiker);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen profiel' });
        }
    }

    static async getDagOpDatum(req, res) {
        const datum = req.query.datum;
        if (!datum) return res.status(400).json({ error: 'Datum ontbreekt' });
        try {
            const info = await StudentModel.getStudentMetStage(req.user.id);
            if (!info) return res.status(404).json({ error: 'Geen student of stage gevonden' });
            const dag = await StudentModel.findDag(info.stage_id, datum);
            if (!dag) return res.status(404).json({ error: 'Nog geen logboek voor deze datum' });
            dag.competenties = await StudentModel.getCompetentiesVanDag(dag.dag_id);
            res.json(dag);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen dag' });
        }
    }
}

module.exports = StudentController;
