const ContractModel = require('../models/contractModel');
const jwt = require('jsonwebtoken');
const { stuurContractLink } = require('../util/mail');
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('FOUT: JWT_SECRET is niet ingesteld in .env'); }

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
        const { token, signature, mentorEmail } = req.body;
        if (!token || !signature) return res.status(400).json({ error: 'Token en handtekening verplicht' });
        if (!mentorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentorEmail)) {
            return res.status(400).json({ error: 'Geldig emailadres voor de mentor is verplicht' });
        }
        try {
            const decoded = jwt.verify(token, SECRET);
            if (decoded.type !== 'mentor_sign') return res.status(400).json({ error: 'Ongeldige token' });
            const contract = await ContractModel.getById(decoded.contractId);
            if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
            if (contract.mentor_getekend) return res.status(409).json({ error: 'Al ondertekend door de mentor' });

            const db = require('../config/db');
            const crypto = require('crypto');
            const argon2 = require('argon2');
            const { stuurWachtwoordLink } = require('../util/mail');

            // Zoek of maak GEBRUIKER voor de mentor
            let [bestaand] = await db.query('SELECT id FROM GEBRUIKER WHERE email = ?', [mentorEmail]);
            let mentorGebruikerId;

            if (bestaand.length > 0) {
                mentorGebruikerId = bestaand[0].id;
            } else {
                const randomPwd = crypto.randomBytes(16).toString('hex');
                const hash = await argon2.hash(randomPwd);
                const voornaam = mentorEmail.split('@')[0];
                const [nieuw] = await db.query(
                    'INSERT INTO GEBRUIKER (voornaam, achternaam, email, wachtwoord, rol) VALUES (?, ?, ?, ?, ?)',
                    [voornaam, '', mentorEmail, hash, 'stagementor']
                );
                mentorGebruikerId = nieuw.insertId;
                console.log('Mentor account aangemaakt:', mentorEmail);
            }

            // Haal bedrijf_id op via de stage
            const [stageRows] = await db.query('SELECT bedrijf_id FROM STAGE WHERE stage_id = ?', [contract.stage_id]);
            const bedrijf_id = stageRows.length > 0 ? stageRows[0].bedrijf_id : null;

            // Zoek of maak STAGEMENTOR record
            let [mentorRecord] = await db.query('SELECT mentor_id FROM STAGEMENTOR WHERE gebruiker_id = ?', [mentorGebruikerId]);
            let mentorId;

            if (mentorRecord.length > 0) {
                mentorId = mentorRecord[0].mentor_id;
                if (bedrijf_id) {
                    await db.query('UPDATE STAGEMENTOR SET bedrijf_id = ? WHERE mentor_id = ?', [bedrijf_id, mentorId]);
                }
            } else {
                const [nieuweMentor] = await db.query(
                    'INSERT INTO STAGEMENTOR (gebruiker_id, bedrijf_id) VALUES (?, ?)',
                    [mentorGebruikerId, bedrijf_id]
                );
                mentorId = nieuweMentor.insertId;
            }

            // Koppel mentor aan stage
            await db.query('UPDATE STAGE SET mentor_id = ? WHERE stage_id = ?', [mentorId, contract.stage_id]);
            console.log('Mentor gekoppeld aan stage:', contract.stage_id, 'mentor_id:', mentorId);

            // Verstuur wachtwoord-aanmaak email naar de mentor
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const pwToken = jwt.sign({ id: mentorGebruikerId, email: mentorEmail, type: 'set_password' }, SECRET, { expiresIn: '48h' });
            await stuurWachtwoordLink(mentorEmail, `${frontendUrl}/set_password.html?token=${pwToken}`);
            console.log('Wachtwoord link verzonden naar mentor:', mentorEmail);

            // Sla handtekening op
            await ContractModel.signAsMentor(decoded.contractId, signature);
            res.json({ message: 'Contract ondertekend door mentor. Er wordt een e-mail gestuurd naar de mentor met een link om een wachtwoord in te stellen.' });
        } catch (err) {
            console.error('[tekenMentor] FOUT:', err.message, err.code);
            const detail = process.env.NODE_ENV === 'development' ? err.message : undefined;
            res.status(400).json({ error: 'Ongeldige of verlopen token', detail });
        }
    }
}

module.exports = ContractController;
