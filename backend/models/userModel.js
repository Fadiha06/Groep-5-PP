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

    static async createUser(voornaam, achternaam, email, wachtwoord, rol) {
        const [result] = await db.query(
            'INSERT INTO GEBRUIKER (voornaam, achternaam, email, wachtwoord, rol) VALUES (?, ?, ?, ?, ?)',
            [voornaam, achternaam, email, wachtwoord, rol]
        );
        return result.insertId;
    }

    static async getAllUsers() {
        const [rows] = await db.query('SELECT id, voornaam, achternaam, email, rol FROM GEBRUIKER ORDER BY id DESC');
        return rows.map(u => ({
            id: u.id,
            naam: `${u.voornaam} ${u.achternaam}`,
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
}

module.exports = UserModel;