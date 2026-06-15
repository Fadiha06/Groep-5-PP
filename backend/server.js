const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({ origin: ['http://localhost:5000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'null'] }));
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
    res.send('Stagebeheer API is running...');
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const stageRoutes = require('./routes/stageRoutes');
const docentRoutes = require('./routes/docentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stage', stageRoutes)
app.use('/api/docent', docentRoutes);

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});