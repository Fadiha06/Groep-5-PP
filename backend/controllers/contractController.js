const ContractModel = require('../models/contractModel');
const jwt = require('jsonwebtoken');
const { stuurContractLink } = require('../util/mail');
const SECRET = process.env.JWT_SECRET || 'supersecret';

class ContractController {

    static async getMijnContract(req, res) {
        try {
            const contract = await ContractModel.getByGebruiker(req.user.id);
            if (!contract) return res.status(404).json({ error: 'Geen contract gevonden voor deze student' });
            res.json(contract);
        } catch (err) {
            console.error('[getMijnContract]', err);
            res.status(500).json({ error: 'Serverfout bij ophalen contract' });
        }
    }

    static async getContract(req, res) {
        try {
            const contract = await ContractModel.getDetailsById(req.params.id);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            res.json(contract);
        } catch (err) {
            console.error('[getContract]', err);
            res.status(500).json({ error: 'Serverfout bij ophalen contract' });
        }
    }

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

            let mailVerstuurd = false;
            // ponytail: mail moved to admin approval step.
            res.json({ message: 'Contract ondertekend door student', mailVerstuurd });
        } catch (err) {
            console.error('[tekenStudent] FOUT:', err.message, err.code);
            const detail = process.env.NODE_ENV === 'development' ? err.message : undefined;
            res.status(500).json({ error: 'Serverfout bij ondertekenen', detail });
        }
    }

    static async mentorLink(req, res) {
        try {
            const contract = await ContractModel.getById(req.params.id);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            const token = jwt.sign({ contractId: Number(req.params.id), type: 'mentor_sign' }, SECRET, { expiresIn: '48h' });
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.json({ link: `${frontendUrl}/mentor_contract.html?token=${token}` });
        } catch (err) {
            console.error('[mentorLink]', err);
            res.status(500).json({ error: 'Serverfout bij genereren mentor-link' });
        }
    }

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
            console.error('[getMentorView]', err);
            res.status(400).json({ error: 'Ongeldige of verlopen token' });
        }
    }

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
            console.error('[tekenMentor] FOUT:', err.message, err.code);
            const detail = process.env.NODE_ENV === 'development' ? err.message : undefined;
            res.status(400).json({ error: 'Ongeldige of verlopen token', detail });
        }
    }
}

module.exports = ContractController;
