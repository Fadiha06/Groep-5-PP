const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET environment variable is missing.");
    process.exit(1);
}

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
const contractRoutes = require('./routes/contractRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const logboekRoutes = require('./routes/logboekRoutes');
const evaluatieRoutes = require('./routes/evaluatieRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stage', stageRoutes);
app.use('/api/contracten', contractRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/logboek', logboekRoutes);
app.use('/api/evaluatie', evaluatieRoutes);

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});