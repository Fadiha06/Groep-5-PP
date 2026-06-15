const StudentModel = require('../models/studentModel');

class StudentController {

    static async getDashboard(req, res) {
        try {
            const gebruikerId = req.user.id;

            const student = await StudentModel.getStudentByGebruikerId(gebruikerId);
            if (!student) {
                return res.status(404).json({ error: 'Studentprofiel niet gevonden' });
            }

            const [stats, stageproces, logboek, notificaties] = await Promise.all([
                StudentModel.getDashboardStats(student.student_id),
                StudentModel.getStageproces(student.student_id),
                StudentModel.getLogboekDezeWeek(student.student_id),
                StudentModel.getNotificaties(gebruikerId)
            ]);

            res.json({
                student,
                stats,
                stageproces,
                logboekDezeWeek: logboek,
                notificaties
            });

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

}

module.exports = StudentController;