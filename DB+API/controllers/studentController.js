const StudentModel = require('../models/studentModel');

class StudentController {

    static async getDashboard(req, res) {
        try {
            const gebruikerId = req.user.id;

            const student = await StudentModel.getStudentByGebruikerId(gebruikerId);
            if (!student) {
                return res.status(404).json({ error: 'Studentprofiel niet gevonden' });
            }

            const stats = await StudentModel.getDashboardStats(student.student_id);

            res.json({ student, stats });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen dashboard' });
        }
    }
}

module.exports = StudentController;