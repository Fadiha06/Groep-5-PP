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

exports.getCompetenties = async (req, res) => {
    try {
        const db = require('../config/db');
        const opleiding = req.query.opleiding_id;

        const [competenties] = await db.query('SELECT * FROM COMPETENTIE WHERE opleiding = ?', [opleiding]);
        for (const c of competenties) {
            const [rubrieken] = await db.query(
                'SELECT rubriek_id, punten AS score, omschrijving FROM RUBRIEK WHERE competentie_id = ? ORDER BY punten ASC',
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
                    'INSERT INTO RUBRIEK (competentie_id, punten, omschrijving) VALUES (?, ?, ?)',
                    [competentieId, r.score, r.omschrijving]
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

// Contracten die de stagecommissie volledig heeft afgehandeld (gecontroleerd + getekend)
// en die de admin nog moet versturen naar student en bedrijf.
exports.getTeVersturen = async (req, res) => {
    try {
        const db = require('../config/db');
        const [rows] = await db.query(`
            SELECT c.contract_id, c.getekend_op,
                   CONCAT(g.voornaam, ' ', g.achternaam) AS student_naam,
                   b.naam AS bedrijf_naam
            FROM CONTRACT c
            JOIN STAGE s ON s.stage_id = c.stage_id
            JOIN STUDENT st ON s.student_id = st.student_id
            JOIN GEBRUIKER g ON g.id = st.gebruiker_id
            LEFT JOIN BEDRIJF b ON b.bedrijf_id = s.bedrijf_id
            WHERE c.docent_getekend = 1 AND c.verzonden_op IS NULL
            ORDER BY c.contract_id DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij ophalen te versturen contracten' });
    }
};

exports.verstuurContract = async (req, res) => {
    try {
        const db = require('../config/db');
        const contractId = req.params.id;

        const [rows] = await db.query(
            `SELECT c.contract_id, c.docent_getekend, c.verzonden_op, s.stage_id,
                    st.gebruiker_id, st.studentnummer
             FROM CONTRACT c
             JOIN STAGE s ON s.stage_id = c.stage_id
             JOIN STUDENT st ON s.student_id = st.student_id
             WHERE c.contract_id = ?`,
            [contractId]
        );
        const contract = rows[0];
        if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });
        if (!contract.docent_getekend) return res.status(400).json({ error: 'Contract is nog niet getekend door de stagecommissie' });
        if (contract.verzonden_op) return res.status(409).json({ error: 'Contract is al verstuurd' });

        await db.query('UPDATE CONTRACT SET verzonden_op = NOW() WHERE contract_id = ?', [contractId]);
        await db.query(
            `INSERT INTO NOTIFICATIE (gebruiker_id, stage_id, titel, bericht, type)
             VALUES (?, ?, ?, ?, ?)`,
            [contract.gebruiker_id, contract.stage_id, 'Je stagecontract is verstuurd',
             'Je stagecontract is goedgekeurd door de stagecommissie en verstuurd. Je kan het nu raadplegen en ondertekenen.', 'contract']
        );

        res.json({ message: 'Contract verstuurd' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij versturen contract' });
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

        const token = jwt.sign({ id: mentor_gebruiker_id, email: email, type: 'set_password' }, process.env.JWT_SECRET, { expiresIn: '48h' });
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
        const db = require('../config/db');

        let query = `
            SELECT 
                CONCAT(g.voornaam, ' ', g.achternaam) AS student,
                b.naam AS bedrijf,
                COALESCE(SUM(ec.score), 0) AS score
            FROM STUDENT st
            JOIN GEBRUIKER g ON st.gebruiker_id = g.id
            JOIN STAGE s ON st.student_id = s.student_id
            LEFT JOIN BEDRIJF b ON s.bedrijf_id = b.bedrijf_id
            LEFT JOIN EVALUATIE e ON s.stage_id = e.stage_id
            LEFT JOIN EVALUATIE_COMPETENTIE ec ON e.evaluatie_id = ec.evaluatie_id
            WHERE g.rol = 'student'
        `;
        const params = [];
        if (stage_ids && stage_ids.length > 0) {
            query += ` AND s.stage_id IN (${stage_ids.map(() => '?').join(',')})`;
            params.push(...stage_ids);
        }
        query += ' GROUP BY s.stage_id, student, bedrijf ORDER BY student ASC';

        const [rows] = await db.query(query, params);

        const csvHeader = 'Student,Bedrijf,Score';
        const csvRows = rows.map(r => `${r.student},${r.bedrijf || 'Geen'},${r.score}`);
        const csv = [csvHeader, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="rapporten_export.csv"');
        res.send(csv);
    } catch (err) {
        console.error(err);
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

// ============================================================
// ADMIN OVEREENKOMST — Contractcontrole
// ============================================================

const STANDAARD_CHECKLIST = [
    { item_id: 1, label: 'Identiteitsbewijs student geldig?', verplicht: true },
    { item_id: 2, label: 'Inschrijvingsbewijs EhB aanwezig?', verplicht: true },
    { item_id: 3, label: 'Overeenkomst volledig ingevuld?', verplicht: true },
    { item_id: 4, label: 'Handtekening student aanwezig?', verplicht: true },
    { item_id: 5, label: 'Handtekening mentor/bedrijf aanwezig?', verplicht: true },
    { item_id: 6, label: 'Verzekeringsattest bedrijf geldig?', verplicht: false },
    { item_id: 7, label: 'Arbeidsovereenkomst of stageovereenkomst conform?', verplicht: true },
    { item_id: 8, label: 'Aansprakelijkheidsverzekering in orde?', verplicht: false },
];

exports.getActieVereist = async (req, res) => {
    try {
        const items = await AdminDashboardModel.getActionRequired();
        res.json(items);
    } catch (err) {
        console.error('getActieVereist:', err);
        res.status(500).json({ error: 'Fout bij ophalen actie-vereist lijst' });
    }
};

exports.getContractControle = async (req, res) => {
    try {
        const contract = await AdminDashboardModel.getContractControle(req.params.id);
        if (!contract) return res.status(404).json({ error: 'Contract niet gevonden' });

        const handtekeningen = {
            student: {
                naam: contract.student_volnaam || 'Student',
                getekend_op: contract.student_getekend ? contract.getekend_op : null,
                status: contract.student_getekend ? 'aanwezig' : 'ontbreekt'
            },
            mentor: {
                naam: contract.mentor_naam || 'Mentor (bedrijf)',
                getekend_op: contract.mentor_getekend ? contract.getekend_op : null,
                status: contract.mentor_getekend ? 'aanwezig' : 'ontbreekt'
            },
            instelling: {
                naam: contract.docent_naam || 'Administrator',
                getekend_op: contract.docent_getekend ? contract.docent_datum : null,
                status: contract.docent_getekend ? 'aanwezig' : 'ontbreekt'
            }
        };

        let checklist = STANDAARD_CHECKLIST.map(item => ({ ...item, afgevinkt: false }));
        if (contract.controle_checklist) {
            try {
                const saved = typeof contract.controle_checklist === 'string'
                    ? JSON.parse(contract.controle_checklist)
                    : contract.controle_checklist;
                checklist = STANDAARD_CHECKLIST.map(item => {
                    const savedItem = saved.find(s => s.item_id === item.item_id);
                    return { ...item, afgevinkt: savedItem ? savedItem.afgevinkt : false };
                });
            } catch (e) {
                console.error('Fout bij parse checklist:', e);
            }
        }

        res.json({
            contract_id: contract.contract_id,
            bedrijf_naam: contract.bedrijf_naam,
            student_naam: contract.student_volnaam,
            opleiding: contract.opleiding,
            periode_start: contract.periode_start,
            periode_eind: contract.periode_eind,
            status_contract: contract.status_contract,
            ingediend_op: contract.aangemaakt_op,
            handtekeningen,
            checklist,
            opmerking: contract.controle_opmerking || ''
        });
    } catch (err) {
        console.error('getContractControle:', err);
        res.status(500).json({ error: 'Fout bij ophalen contractcontrole' });
    }
};

exports.saveContractControle = async (req, res) => {
    try {
        const { checklist, opmerking } = req.body;
        await AdminDashboardModel.saveChecklistAndOpmerking(req.params.id, checklist, opmerking);
        res.json({ message: 'Controle opgeslagen' });
    } catch (err) {
        console.error('saveContractControle:', err);
        res.status(500).json({ error: 'Fout bij opslaan controle' });
    }
};

exports.afwijsContract = async (req, res) => {
    try {
        const { opmerking } = req.body;
        await AdminDashboardModel.rejectContract(req.params.id, opmerking);
        res.json({ message: 'Contract afgewezen' });
    } catch (err) {
        console.error('afwijsContract:', err);
        res.status(500).json({ error: 'Fout bij afwijzen contract' });
    }
};

exports.goedkeurEnVerzend = async (req, res) => {
    try {
        const { checklist, opmerking, signature } = req.body;

        if (checklist || opmerking !== undefined) {
            await AdminDashboardModel.saveChecklistAndOpmerking(req.params.id, checklist, opmerking);
        }

        if (signature) {
            await AdminDashboardModel.approveAndSignContract(req.params.id, signature);
        }

        const db = require('../config/db');
        const [rows] = await db.query('SELECT stage_id FROM CONTRACT WHERE contract_id = ?', [req.params.id]);
        if (rows.length > 0) {
            const stageId = rows[0].stage_id;
            await db.query(
                `INSERT INTO NOTIFICATIE (gebruiker_id, stage_id, titel, bericht, type)
                 SELECT st.gebruiker_id, s.stage_id, 'Contract goedgekeurd', 
                        'Je stagecontract is goedgekeurd door de administrator. Je kan het nu raadplegen en ondertekenen.', 'contract'
                 FROM STAGE s JOIN STUDENT st ON s.student_id = st.student_id WHERE s.stage_id = ?`,
                [stageId]
            );
        }

        res.json({ message: 'Contract goedgekeurd, getekend en verzonden' });
    } catch (err) {
        console.error('goedkeurEnVerzend:', err);
        res.status(500).json({ error: 'Fout bij goedkeuren contract' });
    }
};

