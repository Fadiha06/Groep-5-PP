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
app.use(express.json());const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
    res.send('Stagebeheer API is running...');
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const stageRoutes = require('./routes/stageRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stage', stageRoutes);

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});


// Routes
app.use('/api/auth', require('./routes/userRoutes'));

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