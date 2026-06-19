const AdminDashboardModel = require('../models/adminDashboardModel');
const ContractModel = require('../models/contractModel');

exports.getOpleidingen = async (req, res) => {
    try {
        const db = require('../config/db');
        const [rows] = await db.query('SELECT DISTINCT opleiding FROM COMPETENTIE WHERE opleiding IS NOT NULL AND opleiding != ""');
        res.json(rows.map(r => r.opleiding)); 
    } catch (error) {
        res.status(500).json({ error: 'Serverfout bij ophalen opleidingen' });
    }
};

exports.getCompetenties = async (req, res) => {
    try {
        const db = require('../config/db');
        const opleiding = req.query.opleiding_id;

        const [competenties] = await db.query('SELECT * FROM COMPETENTIE WHERE opleiding = ?', [opleiding]);
        for (const c of competenties) {
            const [rubrieken] = await db.query(
                'SELECT rubriek_id, punten AS score, label, omschrijving FROM RUBRIEK WHERE competentie_id = ? ORDER BY punten ASC',
                [c.competentie_id]
            );
            c.rubrieken = rubrieken;
        }

        const [instRows] = await db.query('SELECT * FROM INSTELLINGEN WHERE opleiding = ?', [opleiding]);
        const instellingen = instRows[0] || {};

        res.json({ competenties, instellingen });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fout bij ophalen competenties' });
    }
};

exports.saveCompetenties = async (req, res) => {
    const db = require('../config/db');
    const { opleiding_id, competenties, instellingen } = req.body;

    if (!opleiding_id || !Array.isArray(competenties)) {
        return res.status(400).json({ error: 'opleiding_id en competenties zijn verplicht' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.query('SELECT competentie_id FROM COMPETENTIE WHERE opleiding = ?', [opleiding_id]);
        const keepIds = competenties.filter(c => c.competentie_id > 0).map(c => c.competentie_id);
        const toDelete = existing.map(r => r.competentie_id).filter(id => !keepIds.includes(id));
        for (const id of toDelete) {
            await connection.query('DELETE FROM COMPETENTIE WHERE competentie_id = ?', [id]);
        }

        for (const c of competenties) {
            let competentieId = c.competentie_id;
            if (!competentieId || competentieId < 0) {
                const [result] = await connection.query(
                    'INSERT INTO COMPETENTIE (naam, omschrijving, opleiding, weging) VALUES (?, ?, ?, ?)',
                    [c.naam, c.omschrijving, opleiding_id, c.weging || 0]
                );
                competentieId = result.insertId;
            } else {
                await connection.query(
                    'UPDATE COMPETENTIE SET naam = ?, omschrijving = ?, weging = ? WHERE competentie_id = ?',
                    [c.naam, c.omschrijving, c.weging || 0, competentieId]
                );
            }

            await connection.query('DELETE FROM RUBRIEK WHERE competentie_id = ?', [competentieId]);
            for (const r of c.rubrieken || []) {
                await connection.query(
                    'INSERT INTO RUBRIEK (competentie_id, punten, label, omschrijving) VALUES (?, ?, ?, ?)',
                    [competentieId, r.score, r.label, r.omschrijving]
                );
            }
        }

        if (instellingen) {
            await connection.query(
                `INSERT INTO INSTELLINGEN (opleiding, max_score, aantal_logboeken, slaagdrempel) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE max_score = ?, aantal_logboeken = ?, slaagdrempel = ?`,
                [opleiding_id, instellingen.max_score, instellingen.aantal_logboeken, instellingen.slaagdrempel,
                 instellingen.max_score, instellingen.aantal_logboeken, instellingen.slaagdrempel]
            );
        }

        await connection.commit();
        res.json({ message: 'Competenties opgeslagen' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Fout bij opslaan competenties' });
    } finally {
        connection.release();
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

        const contract = await ContractModel.getById(contractId);
        if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });

        if (!contract.docent_getekend) {
            if (!signature) return res.status(400).json({ error: 'Handtekening ontbreekt' });
            await ContractModel.signAsDocent(contractId, signature);
        }

        await AdminDashboardModel.updateContractState(contractId, 'goedgekeurd', null);
        res.json({ message: 'Goedgekeurd en getekend' });
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

