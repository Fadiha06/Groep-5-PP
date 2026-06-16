const ContractModel = require('../models/contractModel');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'supersecret';

class ContractController {

    // GET /api/contracten/mijn — contract van de ingelogde student
    static async getMijnContract(req, res) {
        try {
            const contract = await ContractModel.getByGebruiker(req.user.id);
            if (!contract) return res.status(404).json({ error: 'Geen contract gevonden voor deze student' });
            res.json(contract);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen contract' });
        }
    }

    // GET /api/contracten/:id — contract + weergavegegevens
    static async getContract(req, res) {
        try {
            const contract = await ContractModel.getDetailsById(req.params.id);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            res.json(contract);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ophalen contract' });
        }
    }

    // POST /api/contracten/:id/tekenen — student tekent (enkel z'n eigen contract)
    static async tekenStudent(req, res) {
        const { signature } = req.body;
        if (!signature) return res.status(400).json({ error: 'Handtekening ontbreekt' });
        try {
            const eigen = await ContractModel.getByGebruiker(req.user.id);
            if (!eigen || String(eigen.contract_id) !== String(req.params.id)) {
                return res.status(403).json({ error: 'Dit is niet jouw contract' });
            }
            if (eigen.student_getekend) {
                return res.status(409).json({ error: 'Al ondertekend door de student' });
            }
            await ContractModel.signAsStudent(req.params.id, signature);
            res.json({ message: 'Contract ondertekend door student' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ondertekenen' });
        }
    }

    // GET /api/contracten/:id/mentor-link — ondertekenlink voor de mentor
    static async mentorLink(req, res) {
        try {
            const contract = await ContractModel.getById(req.params.id);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            const token = jwt.sign({ contractId: Number(req.params.id), type: 'mentor_sign' }, SECRET, { expiresIn: '7d' });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.json({ link: `${frontendUrl}/mentor_contract.html?token=${token}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij genereren mentor-link' });
        }
    }

    // GET /api/contracten/mentor-view?token=... — contract tonen aan de mentor (via token, geen login)
    static async getMentorView(req, res) {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Token ontbreekt' });
        try {
            const decoded = jwt.verify(token, SECRET);
            if (decoded.type !== 'mentor_sign') return res.status(400).json({ error: 'Ongeldige token' });
            const contract = await ContractModel.getDetailsById(decoded.contractId);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            res.json(contract);
        } catch (err) {
            console.error(err);
            res.status(400).json({ error: 'Ongeldige of verlopen token' });
        }
    }

    // POST /api/contracten/:id/docent-tekenen — verantwoordelijke docent tekent (ingelogd)
    static async tekenDocent(req, res) {
        const { signature } = req.body;
        if (!signature) return res.status(400).json({ error: 'Handtekening ontbreekt' });
        try {
            const contract = await ContractModel.getById(req.params.id);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            const docentGid = await ContractModel.getDocentGebruikerId(req.params.id);
            if (!docentGid || docentGid !== req.user.id) {
                return res.status(403).json({ error: 'Je bent niet de verantwoordelijke docent voor dit contract' });
            }
            if (contract.docent_getekend) {
                return res.status(409).json({ error: 'Al ondertekend door de docent' });
            }
            await ContractModel.signAsDocent(req.params.id, signature);
            res.json({ message: 'Contract ondertekend door docent' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Serverfout bij ondertekenen' });
        }
    }

    // POST /api/contracten/mentor-tekenen — mentor tekent via token (geen login)
    static async tekenMentor(req, res) {
        const { token, signature } = req.body;
        if (!token || !signature) return res.status(400).json({ error: 'Token en handtekening verplicht' });
        try {
            const decoded = jwt.verify(token, SECRET);
            if (decoded.type !== 'mentor_sign') return res.status(400).json({ error: 'Ongeldige token' });
            const contract = await ContractModel.getById(decoded.contractId);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            if (contract.mentor_getekend) return res.status(409).json({ error: 'Al ondertekend door de mentor' });
            await ContractModel.signAsMentor(decoded.contractId, signature);
            res.json({ message: 'Contract ondertekend door mentor' });
        } catch (err) {
            console.error(err);
            res.status(400).json({ error: 'Ongeldige of verlopen token' });
        }
    }
}

module.exports = ContractController;