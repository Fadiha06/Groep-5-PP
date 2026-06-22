const fs = require('fs');
const path = require('path');
const db = require('./config/db');
const argon2 = require('argon2');

async function seed() {
    try {
        console.log('Starting Database Seed...');
        const mysql = require('mysql2/promise');
        const rootConn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root'
        });
        
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'stagebeheer'}`);
        await rootConn.end();
        console.log('Database created.');

        const connection = await db.getConnection();
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split by semicolons, filtering out empty statements
        const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
        
        console.log('Executing schema.sql...');
        // Execute one by one (to avoid multiple statements error if multipleStatements is not enabled in pool)
        // Note: some CREATE TABLE statements might fail if they already exist, so we might want to drop them first or just ignore if they exist.
        // Actually, the original schema doesn't have "IF NOT EXISTS", so it might throw an error if already seeded.
        for (let stmt of statements) {
            try {
                await connection.query(stmt);
            } catch(e) {
                if (e.code === 'ER_TABLE_EXISTS_ERROR') {
                    // Ignore already exists
                } else {
                    console.error('Error executing statement:', stmt.substring(0, 50) + '...', e.message);
                }
            }
        }
        console.log('Schema setup completed.');

        // 3. Add default Admin user
        const hashedPassword = await argon2.hash('Het1sGeenAdm2n_1738!');
        
        // Check if admin already exists
        const [rows] = await connection.query('SELECT * FROM GEBRUIKER WHERE email = ?', ['admin@ehb.be']);
        if (rows.length === 0) {
            const [result] = await connection.query(
                'INSERT INTO GEBRUIKER (voornaam, achternaam, email, wachtwoord, rol) VALUES (?, ?, ?, ?, ?)',
                ['Systeem', 'Beheerder', 'admin@ehb.be', hashedPassword, 'admin']
            );
            
            await connection.query(
                'INSERT INTO ADMINISTRATIE (gebruiker_id, bevoegdheidsniveau) VALUES (?, ?)',
                [result.insertId, 'hoofdadmin']
            );
            console.log('Test Admin created: admin@ehb.be / Het1sGeenAdm2n_1738!');
        } else {
            console.log('Test Admin already exists.');
        }

        // Seed Competenties
        const [compRows] = await connection.query('SELECT * FROM COMPETENTIE');
        if (compRows.length === 0) {
            console.log('Seeding Competenties...');
            await connection.query(`
                INSERT INTO COMPETENTIE (naam, omschrijving, opleiding) VALUES
                ('Programmeren & Ontwerpen', 'Ontwerpen en bouwen van complexe software applicaties', 'Toegepaste Informatica'),
                ('Systeembeheer & Netwerken', 'Opzetten en onderhouden van netwerkinfrastructuren', 'Toegepaste Informatica'),
                ('Projectmanagement', 'Leiden van een IT-project in teamverband', 'Toegepaste Informatica'),
                ('UX/UI Design', 'Ontwerpen van gebruikersvriendelijke en esthetische interfaces', 'Multimedia en Creatieve Technologie'),
                ('Audiovisuele Productie', 'Bewerken en produceren van audio en video', 'Multimedia en Creatieve Technologie'),
                ('Creative Coding', 'Creatief gebruik van code voor visuele toepassingen', 'Multimedia en Creatieve Technologie')
            `);
        }

        // Seed Rubrieken
        const [rubRows] = await connection.query('SELECT COUNT(*) AS n FROM RUBRIEK');
        if (rubRows[0].n === 0) {
            const [comps] = await connection.query('SELECT competentie_id FROM COMPETENTIE');
            if (comps.length > 0) {
                const rubrieken = [];
                for (const c of comps) {
                    rubrieken.push(
                        [c.competentie_id, 1, 'De student toont dit zelden of nauwelijks aan.'],
                        [c.competentie_id, 2, 'De student toont dit met begeleiding aan.'],
                        [c.competentie_id, 3, 'De student toont dit zelfstandig aan.'],
                        [c.competentie_id, 4, 'De student toont dit uitstekend en proactief aan.'],
                        [c.competentie_id, 5, 'De student overtreft de verwachtingen en coacht anderen.']
                    );
                }
                await connection.query(
                    'INSERT INTO RUBRIEK (competentie_id, punten, omschrijving) VALUES ?',
                    [rubrieken]
                );
                console.log('Seeded RUBRIEK levels for ' + comps.length + ' competencies.');
            }
        }

        connection.release();
        console.log('Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
