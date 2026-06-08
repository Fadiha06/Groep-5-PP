const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// connectie pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stagebeheer',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM GEBRUIKER WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Ongeldig email of wachtwoord' });
        }

        const gebruiker = rows[0];
        const isGeldig = await bcrypt.compare(password, gebruiker.wachtwoord);

        if (!isGeldig) {
            return res.status(401).json({ error: 'Ongeldig email of wachtwoord' });
        }

        const token = jwt.sign(
            { id: gebruiker.id, email: gebruiker.email, rol: gebruiker.rol },
            process.env.JWT_SECRET || 'geheim',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: gebruiker.id,
                naam: gebruiker.naam,
                email: gebruiker.email,
                rol: gebruiker.rol
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { naam, email, password, rol } = req.body;

    const toegestaneRollen = ['student', 'docent', 'mentor', 'stagecommissie', 'admin'];

    if (!naam || !email || !password || !rol) {
        return res.status(400).json({ error: 'Alle velden zijn verplicht' });
    }

    if (!toegestaneRollen.includes(rol)) {
        return res.status(400).json({ error: `Ongeldige rol. Kies uit: ${toegestaneRollen.join(', ')}` });
    }

    try {
        const [bestaand] = await pool.query('SELECT id FROM GEBRUIKER WHERE email = ?', [email]);

        if (bestaand.length > 0) {
            return res.status(409).json({ error: 'Email is al in gebruik' });
        }

        const hash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)',
            [naam, email, hash, rol]
        );

        res.status(201).json({ message: 'Gebruiker aangemaakt', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware: JWT verificatie
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Geen token meegegeven' });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'geheim');
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Ongeldig of verlopen token' });
    }
};

// Middleware: rolcontrole
const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
        return res.status(403).json({ error: 'Geen toegang voor jouw rol' });
    }
    next();
};

// GET /api/auth/me
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, naam, email, rol FROM GEBRUIKER WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
