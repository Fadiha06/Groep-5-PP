const StudentModel = require('../models/studentModel');

class StudentController {

    static async getEvaluaties(req, res) {
        try {
            const student_id = req.user.id;
            const [tussentijds, finaal] = await Promise.all([
                StudentModel.getTussentijdseEvaluatie(student_id),
                StudentModel.getFinaleEvaluatie(student_id)
            ]);
            res.json({ tussentijds, finaal });
        } catch (err) {
            console.error('getEvaluaties error:', err);
            res.status(500).json({ error: 'Serverfout bij ophalen evaluaties' });
        }
    }

}

module.exports = StudentController;
