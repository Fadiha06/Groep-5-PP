const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = require('./config/db');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/admin', adminRoutes);

// test
app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        res.json({ status: 'success', message: 'Database connected successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database connection failed', error: err.message });
    }
});

// API user

app.get('/api/gebruikers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, naam, email, rol FROM GEBRUIKER');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/gebruikers/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, naam, email, rol FROM GEBRUIKER WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Gebruiker niet gevonden' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/gebruikers', async (req, res) => {
    const { naam, email, wachtwoord, rol } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)',
            [naam, email, wachtwoord, rol]
        );
        res.status(201).json({ id: result.insertId, naam, email, rol });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});