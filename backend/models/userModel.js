const db = require('../config/db');

class UserModel {
    static async findByEmail(email) {
        const [rows] = await db.query('SELECT * FROM GEBRUIKER WHERE email = ?', [email]);
        return rows;
    }

    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM GEBRUIKER WHERE id = ?', [id]);
        return rows;
    }

    static async createUser(naam, email, wachtwoord, rol) {
        const [result] = await db.query(
            'INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)',
            [naam, email, wachtwoord, rol]
        );
        return result.insertId;
    }

    static async getAllUsers() {
        const [rows] = await db.query('SELECT id, naam, email, rol FROM GEBRUIKER ORDER BY id DESC');
        return rows.map(u => ({
            id: u.id,
            naam: u.naam,
            email: u.email,
            rol: u.rol.charAt(0).toUpperCase() + u.rol.slice(1),
            status: 'Actief'
        }));
    }

    static async updateUser(id, rol) {
        const [result] = await db.query(
            'UPDATE GEBRUIKER SET rol = ? WHERE id = ?',
            [rol, id]
        );
        return result.affectedRows > 0;
    }

    static async deleteUser(id) {
        const [result] = await db.query('DELETE FROM GEBRUIKER WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async updateUser(id, rol, status) {
        // Status wordt momenteel nog niet in de db opgeslagen volgens ERD
        const [result] = await db.query(
            'UPDATE GEBRUIKER SET rol = ? WHERE id = ?',
            [rol, id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = UserModel;