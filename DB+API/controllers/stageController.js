const StageModel = require('../models/stageModel');
const StudentModel = require('../models/studentModel');

class StageController {

 static async submitVoorstel(req, res) {
        try {
            
            const gebruikerId = req.user.id;
            const rol = req.user.rol;

            if (rol !== 'student') {
                return res.status(403).json({ message: 'Alleen geregistreerde studenten mogen een stagevoorstel indienen.' });
            }

            
            const { bedrijf_id, titel, omschrijving, startdatum, einddatum } = req.body;

            if (!bedrijf_id || !titel || !omschrijving || !startdatum || !einddatum) {
                return res.status(400).json({ message: 'Alle velden (bedrijf_id, titel, omschrijving, startdatum, einddatum) zijn verplicht.' });
            }

            
            const studentProfiel = await StudentModel.getProfileByGebruikerId(gebruikerId);
            
            if (!studentProfiel || !studentProfiel.student_id) {
                return res.status(400).json({ message: 'Je hebt je studentprofiel (studentnummer e.d.) nog niet ingevuld. Doe dit eerst via /api/studenten/profiel.' });
            }

            const echteStudentId = studentProfiel.student_id;

            
            const nieuwVoorstelId = await StageModel.createVoorstel(
                echteStudentId,
                bedrijf_id,
                titel,
                omschrijving,
                startdatum,
                einddatum
            );

            res.status(201).json({ 
                message: 'Stagevoorstel succesvol ingediend. Status is "in_aanvraag".', 
                stage_id: nieuwVoorstelId 
            });

        } catch (error) {
            
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'Het opgegeven bedrijf_id bestaat niet in de database.' });
            }
            res.status(500).json({ error: 'Fout bij het indienen van stagevoorstel', details: error.message });
        }
    }
}

module.exports = StageController;