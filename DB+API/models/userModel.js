const pool = require('../config/db');

// Zoek een gebruiker op via email (gebruikt door login én register)
const findByEmail = async (email) => {
    const [rows] = await pool.query(
        'SELECT * FROM GEBRUIKER WHERE email = ?',
        [email]
    );
    return rows[0]; // undefined als niet gevonden
};

// Zoek een gebruiker op via id (voor /me) — zonder wachtwoord
const findById = async (id) => {
    const [rows] = await pool.query(
        'SELECT id, naam, email, rol FROM GEBRUIKER WHERE id = ?',
        [id]
    );
    return rows[0];
};

// Maak een nieuwe gebruiker aan (voor register)
const create = async (naam, email, wachtwoordHash, rol) => {
    const [result] = await pool.query(
        'INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)',
        [naam, email, wachtwoordHash, rol]
    );
    return result.insertId;
};

module.exports = { findByEmail, findById, create };