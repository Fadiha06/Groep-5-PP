const StageModel = require('../models/stageModel');
const StudentModel = require('../models/studentModel');

class StageController {

 static async submitVoorstel(req, res) {
        try {
            // 1. Rechten controleren
            const gebruikerId = req.user.id;
            const rol = req.user.rol;

            if (rol !== 'student') {
                return res.status(403).json({ message: 'Alleen geregistreerde studenten mogen een stagevoorstel indienen.' });
            }

            // 2. Controleren of alle data in de request body zit
            const { bedrijf_id, titel, omschrijving, startdatum, einddatum } = req.body;

            if (!bedrijf_id || !titel || !omschrijving || !startdatum || !einddatum) {
                return res.status(400).json({ message: 'Alle velden (bedrijf_id, titel, omschrijving, startdatum, einddatum) zijn verplicht.' });
            }

            // 3. Echte student_id ophalen uit de STUDENT tabel op basis van het ingelogde gebruikerId
            const studentProfiel = await StudentModel.getProfileByGebruikerId(gebruikerId);
            
            if (!studentProfiel || !studentProfiel.student_id) {
                return res.status(400).json({ message: 'Je hebt je studentprofiel (studentnummer e.d.) nog niet ingevuld. Doe dit eerst via /api/studenten/profiel.' });
            }

            const echteStudentId = studentProfiel.student_id;

            // 4. Model aanroepen om data op te slaan
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
            // Tip: in geval van foreign key error (bijv. onbestaand bedrijf_id) geeft mysql een error code
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: 'Het opgegeven bedrijf_id bestaat niet in de database.' });
            }
            res.status(500).json({ error: 'Fout bij het indienen van stagevoorstel', details: error.message });
        }
    }
}

module.exports = StageController;