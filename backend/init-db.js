const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDB() {
    console.log('Start met database initialisatie...');
    let connection;

    try {
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true 
        });

        const dbName = process.env.DB_NAME || 'stagebeheer';

        console.log(`Database '${dbName}' verwijderen als deze bestaat (voor schone lei)...`);
        await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
        console.log(`Database '${dbName}' aanmaken...`);
        await connection.query(`CREATE DATABASE \`${dbName}\`;`);
        console.log(`Database '${dbName}' is gereed.`);
        await connection.query(`USE \`${dbName}\`;`);

        const schemaPath = path.join(__dirname, 'schema.sql');
        console.log(`Schema bestand inlezen: ${schemaPath}`);
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Tabellen aanmaken...');
        await connection.query(schema);
        console.log('Alle tabellen zijn succesvol aangemaakt!');

    } catch (error) {
        console.error('Fout bij het initialiseren van de database:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('=> Kan geen verbinding maken met MySQL. Zorg dat je MySQL server (zoals XAMPP, WAMP of losse installatie) is gestart!');
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('Connectie gesloten.');
        }
    }
}

initDB();