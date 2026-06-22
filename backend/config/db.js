const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'stage_user',
    password: process.env.DB_PASSWORD || 'EhbD@tAbas3?_67',
    database: process.env.DB_NAME || 'stagebeheer',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;