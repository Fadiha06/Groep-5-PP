const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function insertTestData() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Testdata invoegen...\n');

    // Gebruiker (student)
    const [gebruiker] = await conn.query(
        `INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES ('Samer Test', 'samer@test.be', 'wachtwoord123', 'student')`
    );
    const gebruikerId = gebruiker.insertId;

    // Student
    const [student] = await conn.query(
        `INSERT INTO STUDENT (gebruiker_id, studentnummer, opleiding) VALUES (?, 'S12345', 'Toegepaste Informatica')`,
        [gebruikerId]
    );
    const studentId = student.insertId;

    // Bedrijf
    const [bedrijf] = await conn.query(
        `INSERT INTO BEDRIJF (naam, adres, stad) VALUES ('TechBedrijf NV', 'Teststraat 1', 'Brussel')`
    );
    const bedrijfId = bedrijf.insertId;

    // Stage (gestart 4 weken geleden, duurt 12 weken)
    const startdatum = new Date();
    startdatum.setDate(startdatum.getDate() - 28);
    const einddatum = new Date(startdatum);
    einddatum.setDate(einddatum.getDate() + 84);

    const [stage] = await conn.query(
        `INSERT INTO STAGE (student_id, bedrijf_id, titel, startdatum, einddatum, status, goedkeuringsdatum)
         VALUES (?, ?, 'Stage Backend Development', ?, ?, 'actief', '2025-01-10')`,
        [studentId, bedrijfId, startdatum.toISOString().split('T')[0], einddatum.toISOString().split('T')[0]]
    );
    const stageId = stage.insertId;

    // Contract
    await conn.query(
        `INSERT INTO CONTRACT (stage_id, student_getekend, mentor_getekend, leerkracht_getekend) VALUES (?, 1, 1, 1)`,
        [stageId]
    );

    // Logboek week 1
    const [week] = await conn.query(
        `INSERT INTO LOGBOEK_WEEK (stage_id, weeknummer, status) VALUES (?, 1, 'ingediend')`,
        [stageId]
    );
    const weekId = week.insertId;

    await conn.query(
        `INSERT INTO LOGBOEK_DAG (week_id, stage_id, datum, uren, taken_beschrijving, reflectie, leerpunten)
         VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL 7 DAY), 8, 'API endpoints gebouwd', 'Goed verlopen', 'Express routing geleerd')`,
        [weekId, stageId]
    );

    // Logboek deze week
    const [weekNu] = await conn.query(
        `INSERT INTO LOGBOEK_WEEK (stage_id, weeknummer, status) VALUES (?, 4, 'open')`,
        [stageId]
    );
    const weekNuId = weekNu.insertId;

    await conn.query(
        `INSERT INTO LOGBOEK_DAG (week_id, stage_id, datum, uren, taken_beschrijving, reflectie, leerpunten)
         VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 8, 'Dashboard frontend gebouwd', 'Productieve dag', 'Meer over CSS geleerd')`,
        [weekNuId, stageId]
    );

    // Notificatie
    await conn.query(
        `INSERT INTO NOTIFICATIE (gebruiker_id, stage_id, titel, bericht, type) VALUES (?, ?, 'Logboek indienen', 'Vergeet je logboek niet in te dienen!', 'herinnering')`,
        [gebruikerId, stageId]
    );

    // JWT token genereren
    const token = jwt.sign(
        { id: gebruikerId, email: 'samer@test.be', rol: 'student' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    console.log('✓ Testdata ingevoegd');
    console.log('✓ Token gegenereerd\n');
    console.log('=== JOUW TOKEN (kopieer dit) ===');
    console.log(token);
    console.log('\n=== TEST COMMANDO ===');
    console.log(`Invoke-RestMethod -Uri "http://localhost:3000/api/student/dashboard" -Headers @{Authorization="Bearer ${token}"}`);

    await conn.end();
}

insertTestData().catch(console.error);
