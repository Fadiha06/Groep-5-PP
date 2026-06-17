const db = require('../config/db');

exports.getAllCompetenties = async (req, res) => {
    try {
        const { opleiding } = req.query;
        let query = 'SELECT * FROM COMPETENTIE';
        const params = [];
        if (opleiding) {
            query += ' WHERE opleiding = ?';
            params.push(opleiding);
        }
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching competenties:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createCompetentie = async (req, res) => {
    try {
        const { naam, omschrijving, opleiding } = req.body;
        if (!naam || !opleiding) {
            return res.status(400).json({ error: 'Naam en opleiding zijn verplicht' });
        }
        const [result] = await db.query(
            'INSERT INTO COMPETENTIE (naam, omschrijving, opleiding) VALUES (?, ?, ?)',
            [naam, omschrijving, opleiding]
        );
        res.status(201).json({ message: 'Competentie aangemaakt', id: result.insertId });
    } catch (err) {
        console.error('Error creating competentie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateCompetentie = async (req, res) => {
    try {
        const { id } = req.params;
        const { naam, omschrijving, opleiding } = req.body;
        if (!naam || !opleiding) {
            return res.status(400).json({ error: 'Naam en opleiding zijn verplicht' });
        }
        await db.query(
            'UPDATE COMPETENTIE SET naam = ?, omschrijving = ?, opleiding = ? WHERE competentie_id = ?',
            [naam, omschrijving, opleiding, id]
        );
        res.json({ message: 'Competentie bijgewerkt' });
    } catch (err) {
        console.error('Error updating competentie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteCompetentie = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM COMPETENTIE WHERE competentie_id = ?', [id]);
        res.json({ message: 'Competentie verwijderd' });
    } catch (err) {
        console.error('Error deleting competentie:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
