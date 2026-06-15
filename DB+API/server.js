const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const pool = require('./config/db');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/userRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));

// Test route — database connectie
app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        res.json({ status: 'success', message: 'Database connected successfully' });
    }
    catch (err) {
        res.status(500).json({ status: 'error', message: 'Database connection failed', error: err.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Er is iets misgegaan' });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});