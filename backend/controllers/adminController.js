const AdminDashboardModel = require('../models/adminDashboardModel');

exports.getOpleidingen = async (req, res) => {
    try {
        const db = require('../config/db');
        const [rows] = await db.query('SELECT DISTINCT opleiding FROM COMPETENTIE WHERE opleiding IS NOT NULL AND opleiding != ""');
        res.json(rows.map(r => r.opleiding)); 
    } catch (error) {
        res.status(500).json({ error: 'Serverfout bij ophalen opleidingen' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await AdminDashboardModel.getStats();
        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij het ophalen van statistieken' });
    }
};

exports.getContractsList = async (req, res) => {
    try {
        const stages = await AdminDashboardModel.getAllStages();
        res.json(stages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij het ophalen van stagecontracten' });
    }
};

exports.getActionRequired = async (req, res) => {
    try {
        const items = await AdminDashboardModel.getActionRequired();
        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij het ophalen van actie vereist items' });
    }
};

exports.getActivity = async (req, res) => {
    try {
        const items = await AdminDashboardModel.getActivity();
        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij het ophalen van activiteit' });
    }
};

exports.getContractDetails = async (req, res) => {
    try {
        const stageId = req.params.id;
        const contract = await AdminDashboardModel.getContractDetails(stageId);
        if (!contract) {
            return res.status(404).json({ error: 'Contract niet gevonden' });
        }
        res.json(contract);
    } catch (error) {
        res.status(500).json({ error: 'Fout bij het ophalen van contract details' });
    }
};

exports.getContractControle = async (req, res) => {
    try {
        const contractId = req.params.id;
        const dbContract = await AdminDashboardModel.getContractControle(contractId);
        if (!dbContract) {
            return res.status(404).json({ error: 'Contract niet gevonden' });
        }

        // Map DB result to frontend expected structure
        const contract = {
            contract_id: dbContract.contract_id,
            bedrijf_naam: dbContract.bedrijf_naam || 'Onbekend',
            student_naam: dbContract.student_naam || 'Onbekend',
            opleiding: dbContract.opleiding || 'Onbekend',
            periode_start: dbContract.periode_start,
            periode_eind: dbContract.periode_eind,
            status_contract: dbContract.status_contract,
            ingediend_op: dbContract.ingediend_op,
            handtekeningen: {
                student: { 
                    naam: dbContract.student_naam, 
                    getekend_op: dbContract.student_getekend ? dbContract.getekend_op : null, 
                    status: dbContract.student_getekend ? 'aanwezig' : 'ontbreekt' 
                },
                mentor: { 
                    naam: 'Mentor Bedrijf', 
                    getekend_op: dbContract.mentor_getekend ? dbContract.getekend_op : null, 
                    status: dbContract.mentor_getekend ? 'aanwezig' : 'ontbreekt' 
                },
                instelling: { 
                    naam: 'Administratie', 
                    getekend_op: dbContract.docent_getekend ? dbContract.getekend_op : null, 
                    status: dbContract.docent_getekend ? 'aanwezig' : 'ontbreekt' 
                }
            },
            checklist: [
                { item_id: 1, label: "Risicoanalyse ingevuld en geüpload", verplicht: true, afgevinkt: false },
                { item_id: 2, label: "Werkpostfiche aanwezig en ondertekend", verplicht: true, afgevinkt: false },
                { item_id: 3, label: "Voldoet aan minimale stage-uren", verplicht: true, afgevinkt: false },
                { item_id: 4, label: "Verzekeringsattest doorgestuurd", verplicht: false, afgevinkt: false }
            ],
            opmerking: ""
        };

        res.json(contract);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij het ophalen van contract controle data' });
    }
};

exports.saveContractControle = async (req, res) => {
    try {
        const contractId = req.params.id;
        const { checklist, opmerking } = req.body;
        // Mock save logic for now
        res.json({ message: 'Opgeslagen' });
    } catch (err) {
        res.status(500).json({ error: 'Fout bij opslaan' });
    }
};

exports.rejectContract = async (req, res) => {
    try {
        const contractId = req.params.id;
        const { opmerking } = req.body;
        await AdminDashboardModel.updateContractState(contractId, 'geweigerd', opmerking);
        res.json({ message: 'Afgewezen' });
    } catch (err) {
        res.status(500).json({ error: 'Fout bij afwijzen' });
    }
};

exports.approveContract = async (req, res) => {
    try {
        const contractId = req.params.id;
        const { signature } = req.body;
        if (!signature) return res.status(400).json({ error: 'Handtekening ontbreekt' });

        const db = require('../config/db');
        const ContractModel = require('../models/contractModel');

        await ContractModel.signAsDocent(contractId, signature);

        res.json({ message: 'Overeenkomst goedgekeurd en ondertekend door administratie.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fout bij goedkeuren' });
    }
};

exports.createMentor = async (req, res) => {
    try {
        const { stage_id, voornaam, achternaam, email, afdeling, telefoonnummer } = req.body;
        const db = require('../config/db');
        const argon2 = require('argon2');
        const jwt = require('jsonwebtoken');
        const { stuurWachtwoordLink } = require('../util/mail');

        const [stageRows] = await db.query('SELECT bedrijf_id FROM STAGE WHERE stage_id = ?', [stage_id]);
        if (stageRows.length === 0) return res.status(404).json({ error: 'Stage niet gevonden' });
        const bedrijf_id = stageRows[0].bedrijf_id;

        const defaultPasswordHash = await argon2.hash(require('crypto').randomBytes(32));
        const [gebruikerResult] = await db.query(
            'INSERT INTO GEBRUIKER (voornaam, achternaam, email, wachtwoord, rol) VALUES (?, ?, ?, ?, ?)',
            [voornaam, achternaam, email, defaultPasswordHash, 'mentor']
        );
        const mentor_gebruiker_id = gebruikerResult.insertId;

        const [mentorResult] = await db.query(
            'INSERT INTO STAGEMENTOR (gebruiker_id, bedrijf_id, afdeling, telefoonnummer) VALUES (?, ?, ?, ?)',
            [mentor_gebruiker_id, bedrijf_id, afdeling || null, telefoonnummer || null]
        );
        const mentor_id = mentorResult.insertId;

        await db.query('UPDATE STAGE SET mentor_id = ? WHERE stage_id = ?', [mentor_id, stage_id]);

        const token = jwt.sign({ id: mentor_gebruiker_id, type: 'set_password' }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '48h' });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = `${frontendUrl}/set_password.html?token=${token}`;
        
        try {
            await stuurWachtwoordLink(email, link);
        } catch (mailError) {
            console.error('Mail error:', mailError);
        }

        res.json({ message: 'Mentor aangemaakt, gelinkt aan stage, en wachtwoord link verstuurd.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fout bij aanmaken mentor' });
    }
};

exports.assignDocent = async (req, res) => {
    try {
        const { stage_id, docent_gebruiker_id } = req.body;
        const db = require('../config/db');
        const [docentRows] = await db.query('SELECT docent_id FROM DOCENT WHERE gebruiker_id = ?', [docent_gebruiker_id]);
        
        let docent_id;
        if (docentRows.length === 0) {
            // Maak on-the-fly een docent profiel aan als deze gebruiker (met rol docent) nog niet in de DOCENT tabel staat.
            const [insertResult] = await db.query('INSERT INTO DOCENT (gebruiker_id) VALUES (?)', [docent_gebruiker_id]);
            docent_id = insertResult.insertId;
        } else {
            docent_id = docentRows[0].docent_id;
        }

        await db.query('UPDATE STAGE SET leerkracht_id = ? WHERE stage_id = ?', [docent_id, stage_id]);
        res.json({ message: 'Docent succesvol toegewezen aan stage.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fout bij toewijzen docent' });
    }
};

exports.getStagesZonderMentor = async (req, res) => {
    try {
        const db = require('../config/db');
        const [rows] = await db.query(`
            SELECT s.stage_id, s.titel, CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam, b.naam AS bedrijf_naam
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON g.id = st.gebruiker_id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE s.mentor_id IS NULL AND s.status != 'geweigerd'
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout' });
    }
};

exports.getStagesZonderDocent = async (req, res) => {
    try {
        const db = require('../config/db');
        const [rows] = await db.query(`
            SELECT s.stage_id, s.titel, CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam, b.naam AS bedrijf_naam
            FROM STAGE s
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON g.id = st.gebruiker_id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            WHERE s.leerkracht_id IS NULL AND s.status != 'geweigerd'
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout' });
    }
};

exports.getAdminRapporten = async (req, res) => {
    try {
        const data = await AdminDashboardModel.getAdminRapporten();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Fout bij ophalen rapporten' });
    }
};

exports.exportRapporten = async (req, res) => {
    try {
        const { stage_ids } = req.body;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="rapporten_export.csv"');
        res.send('Student,Bedrijf,Score\\nMock,Data,100'); // Mock CSV
    } catch (err) {
        res.status(500).json({ error: 'Fout bij export' });
    }
};

exports.reviewContract = async (req, res) => {
    try {
        const stageId = req.params.id;
        const { status, reden_weigering } = req.body;
        
        await AdminDashboardModel.updateContractStatus(stageId, status, reden_weigering);
        res.json({ message: 'Contract status succesvol bijgewerkt' });
    } catch (error) {
        res.status(500).json({ error: 'Fout bij het beoordelen van het contract' });
    }
};

exports.getReports = async (req, res) => {
    try {
        const reports = await AdminDashboardModel.getStudentReports();
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: 'Fout bij het ophalen van rapporten' });
    }
};

exports.getContractenTeTekenen = async (req, res) => {
    try {
        const pool = require('../config/db');
        const [rows] = await pool.query(`
            SELECT c.contract_id, c.student_getekend, c.mentor_getekend, c.docent_getekend,
                   CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                   b.naam AS bedrijf_naam,
                   st.startdatum, st.einddatum
            FROM CONTRACT c
            JOIN STAGE st ON st.stage_id = c.stage_id
            JOIN STUDENT s ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON g.id = s.gebruiker_id
            LEFT JOIN BEDRIJF b ON b.bedrijf_id = st.bedrijf_id
            ORDER BY c.contract_id DESC
        `);
        res.json(rows.map(r => ({
            contract_id: r.contract_id,
            student_naam: r.student_naam,
            bedrijf_naam: r.bedrijf_naam || '—',
            startdatum: r.startdatum,
            einddatum: r.einddatum,
            student_getekend: !!r.student_getekend,
            mentor_getekend: !!r.mentor_getekend,
            admin_getekend: !!r.docent_getekend
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout' });
    }
};
