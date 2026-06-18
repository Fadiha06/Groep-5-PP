const db = require('../config/db');

exports.getAllCompetenties = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM COMPETENTIE ORDER BY naam ASC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching competenties:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createCompetentie = async (req, res) => {
    try {
        const { naam, omschrijving } = req.body;
        if (!naam) {
            return res.status(400).json({ error: 'Naam is verplicht' });
        }
        const [result] = await db.query(
            'INSERT INTO COMPETENTIE (naam, omschrijving) VALUES (?, ?)',
            [naam, omschrijving || null]
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
        const { naam, omschrijving } = req.body;
        if (!naam) {
            return res.status(400).json({ error: 'Naam is verplicht' });
        }
        await db.query(
            'UPDATE COMPETENTIE SET naam = ?, omschrijving = ? WHERE competentie_id = ?',
            [naam, omschrijving || null, id]
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