const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connectie pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stagebeheer',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connectie
app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        res.json({ status: 'success', message: 'Database connected successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database connection failed', error: err.message });
    }
});

// --- API ROUTES VOOR GEBRUIKER ---

// Get all users
app.get('/api/gebruikers', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, naam, email, rol FROM GEBRUIKER');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user by ID
app.get('/api/gebruikers/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, naam, email, rol FROM GEBRUIKER WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Gebruiker niet gevonden' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create user
app.post('/api/gebruikers', async (req, res) => {
    const { naam, email, wachtwoord, rol } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)',
            [naam, email, wachtwoord, rol] // Opmerking: In productie wachtwoord hashen!
        );
        res.status(201).json({ id: result.insertId, naam, email, rol });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API ROUTES VOOR BEDRIJF ---

// Get all companies
app.get('/api/bedrijven', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM BEDRIJF');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create company
app.post('/api/bedrijven', async (req, res) => {
    const { naam, adres, stad, btw_nummer, telefoon, email, sector } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO BEDRIJF (naam, adres, stad, btw_nummer, telefoon, email, sector) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [naam, adres, stad, btw_nummer, telefoon, email, sector]
        );
        res.status(201).json({ id: result.insertId, naam, adres, stad });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- API ROUTES VOOR STAGE ---

// Get all internships
app.get('/api/stages', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM STAGE');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create internship
app.post('/api/stages', async (req, res) => {
    const { student_id, titel, omschrijving, startdatum, einddatum } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO STAGE (student_id, titel, omschrijving, startdatum, einddatum) VALUES (?, ?, ?, ?, ?)',
            [student_id, titel, omschrijving, startdatum, einddatum]
        );
        res.status(201).json({ id: result.insertId, student_id, titel });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
