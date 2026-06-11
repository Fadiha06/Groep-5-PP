const ContractModel = require('../models/contractModel');
const jwt = require('jsonwebtoken');

class ContractController {

    static async generateMentorLink(req, res) {
        try {
            const contractId = req.params.id;
            const contract = await ContractModel.getById(contractId);
            
            if (!contract) {
                return res.status(404).json({ message: 'Contract niet gevonden.' });
            }

            // Genereer een speciaal token voor de mentor, geldig voor 7 dagen
            const token = jwt.sign(
                { id: `mentor_${contractId}`, rol: 'mentor', contractId: contractId },
                process.env.JWT_SECRET || 'geheim_sleutel_123',
                { expiresIn: '7d' }
            );

            // Stel dat de VITE frontend draait op dezelfde localhost of een specifiek domein
            const mentorLink = `http://localhost:3000/VITE/mentor-tekenen.html?token=${token}`;

            res.json({ 
                message: 'Mentor link succesvol gegenereerd.',
                link: mentorLink
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Fout bij het genereren van de mentor link' });
        }
    }

    static async signContract(req, res) {
        try {
            const contractId = req.params.id;
            const { signature } = req.body; // Dit moet de Base64 string zijn
            
            // Haal de rol van de ingelogde gebruiker op
            const rol = req.user.rol;

            if (!signature || !signature.startsWith('data:image/')) {
                return res.status(400).json({ message: 'Ongeldige of ontbrekende Base64 handtekening.' });
            }

            const contract = await ContractModel.getById(contractId);
            if (!contract) {
                return res.status(404).json({ message: 'Contract niet gevonden.' });
            }

            // Bepaal welke kolom geüpdatet moet worden op basis van de rol
            if (rol === 'student') {
                await ContractModel.signAsStudent(contractId, signature);
                return res.json({ message: 'Contract succesvol getekend door student.' });
            } else if (rol === 'mentor') {
                await ContractModel.signAsMentor(contractId, signature);
                return res.json({ message: 'Contract succesvol getekend door mentor.' });
            } else {
                return res.status(403).json({ message: 'Jouw rol mag geen contracten tekenen.' });
            }

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Fout bij het opslaan van de handtekening', details: error.message });
        }
    }
}

module.exports = ContractController;
