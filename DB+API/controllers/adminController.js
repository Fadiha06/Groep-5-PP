const pool = require('../config/db');

class AdminController {
    static async getAllUsers(req, res) {
        try {
            const [rows] = await pool.query('SELECT id, naam, email, rol FROM GEBRUIKER');
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async createUser(req, res) {
        const { email, rol } = req.body;
        try {
            const naam = email.split('@')[0];
            const tempWachtwoord = 'TijdelijkWachtwoord123';
            
            const [result] = await pool.query(
                'INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)',
                [naam, email, tempWachtwoord, rol]
            );
            
            res.status(201).json({ id: result.insertId, naam, email, rol });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = AdminController;
