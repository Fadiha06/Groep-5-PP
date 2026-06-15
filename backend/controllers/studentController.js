const studentModel = require('../models/studentModel');

// Hulpfunctie: in welke week van de stage valt deze datum?
const berekenWeeknummer = (datum, startdatum) => {
    const start = new Date(startdatum);
    const dag = new Date(datum);
    const verschilInDagen = Math.floor((dag - start) / (1000 * 60 * 60 * 24));
    return Math.floor(verschilInDagen / 7) + 1;
};

// POST /api/student/logboek — een dag invullen of bijwerken
const vulDagIn = async (req, res) => {
    const { datum, taken_beschrijving, competenties } = req.body;
    const uren = req.body.uren ?? null;
    const reflectie = req.body.reflectie ?? null;
    const leerpunten = req.body.leerpunten ?? null;

    if (!datum || !taken_beschrijving) {
        return res.status(400).json({ error: 'Datum en taken zijn verplicht' });
    }

    try {
        const info = await studentModel.getStudentMetStage(req.user.id);
        if (!info) {
            return res.status(404).json({ error: 'Geen student of stage gevonden' });
        }

        // Weeknummer berekenen uit de datum
        const weeknummer = berekenWeeknummer(datum, info.startdatum);
        if (weeknummer < 1) {
            return res.status(400).json({ error: 'Datum valt vóór de start van de stage' });
        }

        // Week zoeken
        let week = await studentModel.findWeek(info.stage_id, weeknummer);

        // Een al ingediende week mag niet meer bewerkt worden
        if (week && week.status === 'ingediend') {
            return res.status(403).json({ error: 'Deze week is al ingediend en kan niet meer bewerkt worden' });
        }

        // Week aanmaken als die nog niet bestaat
        let weekId;
        if (week) {
            weekId = week.week_id;
        } else {
            weekId = await studentModel.createWeek(info.stage_id, weeknummer);
        }

        // Upsert: dag bijwerken als hij bestaat, anders aanmaken
        const bestaandeDag = await studentModel.findDag(info.stage_id, datum);
        let dagId;
        let nieuw;
        if (bestaandeDag) {
            await studentModel.updateDag(bestaandeDag.dag_id, uren, taken_beschrijving, reflectie, leerpunten);
            dagId = bestaandeDag.dag_id;
            nieuw = false;
        } else {
            dagId = await studentModel.createDag(weekId, info.stage_id, datum, uren, taken_beschrijving, reflectie, leerpunten);
            nieuw = true;
        }

        // Competenties van de dag opslaan (als ze meegestuurd zijn)
        if (Array.isArray(competenties)) {
            await studentModel.slaCompetentiesOp(dagId, info.student_id, competenties);
        }

        return res.status(nieuw ? 201 : 200).json({
            message: nieuw ? 'Dag toegevoegd' : 'Dag bijgewerkt',
            dag_id: dagId,
            weeknummer
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij invullen logboek' });
    }
};

// GET /api/student/logboek/week/:nr — een week ophalen met al zijn dagen
const getWeek = async (req, res) => {
    const weeknummer = Number(req.params.nr);

    try {
        const info = await studentModel.getStudentMetStage(req.user.id);
        if (!info) {
            return res.status(404).json({ error: 'Geen student of stage gevonden' });
        }

        const week = await studentModel.findWeek(info.stage_id, weeknummer);
        if (!week) {
            return res.status(404).json({ error: 'Deze week bestaat nog niet' });
        }

        const dagen = await studentModel.getDagenVanWeek(week.week_id);

        res.json({
            weeknummer: week.weeknummer,
            status: week.status,
            ingediend_op: week.ingediend_op,
            dagen
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen week' });
    }
};

// PUT /api/student/logboek/week/:nr/indienen — een week indienen
const dienWeekIn = async (req, res) => {
    const weeknummer = Number(req.params.nr);

    try {
        const info = await studentModel.getStudentMetStage(req.user.id);
        if (!info) {
            return res.status(404).json({ error: 'Geen student of stage gevonden' });
        }

        const week = await studentModel.findWeek(info.stage_id, weeknummer);
        if (!week) {
            return res.status(404).json({ error: 'Deze week bestaat nog niet' });
        }

        if (week.status === 'ingediend') {
            return res.status(409).json({ error: 'Deze week is al ingediend' });
        }

        await studentModel.dienWeekIn(week.week_id);
        res.json({ message: `Week ${weeknummer} ingediend` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij indienen week' });
    }
};

const getLaatste = async (req, res) => {
    try {
        const dag = await studentModel.getLaatsteDag(req.user.id);
        if (!dag) {
            return res.status(404).json({ error: 'Nog geen logboek ingevuld' });
        }
        res.json(dag);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen laatste logboek' });
    }
};

const getStageInfo = async (req, res) => {
    try {
        const stage = await studentModel.getStageHeader(req.user.id);
        if (!stage) {
            return res.status(404).json({ error: 'Geen stage gevonden' });
        }
        res.json(stage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen stage-info' });
    }
};

// GET /api/student/competenties — alle competenties ophalen
const getCompetenties = async (req, res) => {
    try {
        const lijst = await studentModel.getAlleCompetenties();
        res.json(lijst);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen competenties' });
    }
};

// GET /api/student/logboek/dag/:dagId/competenties — competenties van een dag
const getDagCompetenties = async (req, res) => {
    const dagId = Number(req.params.dagId);
    try {
        const lijst = await studentModel.getCompetentiesVanDag(dagId);
        res.json(lijst);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen dag-competenties' });
    }
};

module.exports = { vulDagIn, getWeek, dienWeekIn, getLaatste, getStageInfo, getCompetenties, getDagCompetenties };