const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const studentRoutes = require('./routes/studentRoutes');
app.use('/api/student', studentRoutes);

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

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, wachtwoord } = req.body;
    try {
        const [rows] = await pool.query(
            'SELECT id, naam, email, rol, wachtwoord FROM GEBRUIKER WHERE email = ?',
            [email]
        );
        if (!rows.length || rows[0].wachtwoord !== wachtwoord) {
            return res.status(401).json({ error: 'Ongeldig e-mailadres of wachtwoord' });
        }
        const gebruiker = rows[0];
        const token = jwt.sign(
            { id: gebruiker.id, email: gebruiker.email, rol: gebruiker.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token, naam: gebruiker.naam, rol: gebruiker.rol });
    } catch (err) {
        res.status(500).json({ error: err.message });
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