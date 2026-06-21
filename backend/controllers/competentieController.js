const db = require('../config/db');

exports.getAllCompetenties = async (req, res) => {
    try {
        const opleiding = req.query.opleiding;
        let competenties;
        if (opleiding) {
            [competenties] = await db.query('SELECT * FROM COMPETENTIE WHERE opleiding = ?', [opleiding]);
        } else {
            [competenties] = await db.query('SELECT * FROM COMPETENTIE');
        }
        
        for (let comp of competenties) {
            const [rubrieken] = await db.query('SELECT * FROM RUBRIEK WHERE competentie_id = ? ORDER BY punten ASC', [comp.competentie_id]);
            comp.rubrieken = rubrieken;
        }

        const [instRows] = opleiding
            ? await db.query('SELECT * FROM INSTELLINGEN WHERE opleiding = ?', [opleiding])
            : await db.query('SELECT * FROM INSTELLINGEN');
        const instellingen = Object.fromEntries(instRows.map(r => [r.opleiding, { max_score: r.max_score, aantal_logboeken: r.aantal_logboeken, slaagdrempel: r.slaagdrempel }]));

        res.json({ competenties, instellingen });
    } catch (error) {
        res.status(500).json({ error: 'Fout bij ophalen competenties' });
    }
};

exports.createCompetentie = async (req, res) => {
    try {
        const { naam, omschrijving, opleiding, weging, rubrieken } = req.body;
        
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const [compResult] = await connection.query(
                'INSERT INTO COMPETENTIE (naam, omschrijving, opleiding, weging) VALUES (?, ?, ?, ?)',
                [naam, omschrijving, opleiding || 'Toegepaste Informatica', weging || 0]
            );
            
            const competentieId = compResult.insertId;

            if (rubrieken && rubrieken.length > 0) {
                for (let rubriek of rubrieken) {
                    await connection.query(
                        'INSERT INTO RUBRIEK (competentie_id, punten, omschrijving) VALUES (?, ?, ?)',
                        [competentieId, rubriek.punten, rubriek.omschrijving]
                    );
                }
            }

            await connection.commit();
            connection.release();

            res.status(201).json({ message: 'Competentie aangemaakt', id: competentieId });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (error) {
        res.status(500).json({ error: 'Fout bij aanmaken competentie' });
    }
};

exports.updateCompetentie = async (req, res) => {
    try {
        const competentieId = req.params.id;
        const { naam, omschrijving, opleiding, weging, rubrieken } = req.body;
        
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            await connection.query(
                'UPDATE COMPETENTIE SET naam = ?, omschrijving = ?, opleiding = ?, weging = ? WHERE competentie_id = ?',
                [naam, omschrijving, opleiding || 'Toegepaste Informatica', weging || 0, competentieId]
            );

            await connection.query('DELETE FROM RUBRIEK WHERE competentie_id = ?', [competentieId]);

            if (rubrieken && rubrieken.length > 0) {
                for (let rubriek of rubrieken) {
                    await connection.query(
                        'INSERT INTO RUBRIEK (competentie_id, punten, omschrijving) VALUES (?, ?, ?)',
                        [competentieId, rubriek.punten, rubriek.omschrijving]
                    );
                }
            }

            await connection.commit();
            connection.release();

            res.json({ message: 'Competentie bijgewerkt' });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (error) {
        res.status(500).json({ error: 'Fout bij bijwerken competentie' });
    }
};
