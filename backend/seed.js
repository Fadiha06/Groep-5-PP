const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function seed() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    // Stage loopt van 6 weken geleden tot 6 weken in de toekomst (midden van de stage)
    const start = new Date();
    start.setDate(start.getDate() - 42); // 6 weken geleden
    const einde = new Date();
    einde.setDate(einde.getDate() + 42); // 6 weken later
    const goedkeuring = new Date(start);
    goedkeuring.setDate(goedkeuring.getDate() - 14);

    const fmt = d => d.toISOString().split('T')[0];

    // Gebruiker
    const [g] = await conn.query(
        `INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES ('Samer', 'samer@ehb.be', 'wachtwoord123', 'student')`
    );
    const gebruikerId = g.insertId;

    // Student
    const [s] = await conn.query(
        `INSERT INTO STUDENT (gebruiker_id, studentnummer, opleiding) VALUES (?, 'S20055', 'Toegepaste Informatica')`,
        [gebruikerId]
    );
    const studentId = s.insertId;

    // Bedrijf
    const [b] = await conn.query(
        `INSERT INTO BEDRIJF (naam, adres, stad) VALUES ('Accenture Belgium', 'Havenlaan 86', 'Brussel')`
    );

    // Stage
    const [st] = await conn.query(
        `INSERT INTO STAGE (student_id, bedrijf_id, titel, startdatum, einddatum, status, goedkeuringsdatum)
         VALUES (?, ?, 'Full Stack Developer', ?, ?, 'actief', ?)`,
        [studentId, b.insertId, fmt(start), fmt(einde), fmt(goedkeuring)]
    );
    const stageId = st.insertId;

    // Contract getekend
    await conn.query(
        `INSERT INTO CONTRACT (stage_id, student_getekend, mentor_getekend, leerkracht_getekend) VALUES (?, 1, 1, 1)`,
        [stageId]
    );

    // Logboek — 5 weken ingediend, huidige week open
    for (let w = 1; w <= 6; w++) {
        const status = w < 6 ? 'ingediend' : 'open';
        const ingediend = w < 6 ? `'${fmt(new Date(start.getTime() + w * 7 * 86400000))}'` : 'NULL';

        const [week] = await conn.query(
            `INSERT INTO LOGBOEK_WEEK (stage_id, weeknummer, status, ingediend_op) VALUES (?, ?, ?, ${ingediend})`,
            [stageId, w, status]
        );

        // Dagen voor elke week (ma-vrij)
        for (let d = 0; d < 5; d++) {
            const dag = new Date(start.getTime() + ((w - 1) * 7 + d) * 86400000);
            const taken = ['Backend API ontwikkeld', 'Database queries geoptimaliseerd', 'Frontend componenten gebouwd', 'Code review + documentatie', 'Testing & bugfixes'][d];
            await conn.query(
                `INSERT INTO LOGBOEK_DAG (week_id, stage_id, datum, uren, taken_beschrijving, reflectie, leerpunten)
                 VALUES (?, ?, ?, 8, ?, 'Goede dag', 'Veel bijgeleerd')`,
                [week.insertId, stageId, fmt(dag), taken]
            );
        }
    }

    // Notificatie
    await conn.query(
        `INSERT INTO NOTIFICATIE (gebruiker_id, stage_id, titel, bericht, type)
         VALUES (?, ?, 'Logboek week 6', 'Vul je logboek in voor deze week!', 'herinnering')`,
        [gebruikerId, stageId]
    );

    // Token
    const token = jwt.sign(
        { id: gebruikerId, email: 'samer@ehb.be', rol: 'student' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    console.log('\n✓ Samer aangemaakt — stage loopt al 6 weken, nog 6 weken te gaan\n');
    console.log('TOKEN:');
    console.log(token);

    await conn.end();
}

seed().catch(console.error);
