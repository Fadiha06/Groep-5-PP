// migrate_logboek.js
// Draai dit als de LOGBOEK tabellen ontbreken in de database.
// Gebruik: node migrate_logboek.js

const pool = require('./config/db');

async function migrate() {
    console.log('Controleren en aanmaken van ontbrekende LOGBOEK tabellen...');
    const conn = await pool.getConnection();

    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS LOGBOEK_WEEK (
                week_id INT AUTO_INCREMENT PRIMARY KEY,
                stage_id INT NOT NULL,
                weeknummer INT NOT NULL,
                ingediend_op DATETIME,
                totaal_uren DECIMAL(5,2),
                status VARCHAR(50) DEFAULT 'open',
                mentor_feedback TEXT,
                FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
            )
        `);
        console.log('  LOGBOEK_WEEK: OK');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS LOGBOEK_DAG (
                dag_id INT AUTO_INCREMENT PRIMARY KEY,
                week_id INT NOT NULL,
                stage_id INT NOT NULL,
                datum DATE NOT NULL,
                uren DECIMAL(5,2),
                taken_beschrijving TEXT,
                reflectie TEXT,
                leerpunten TEXT,
                FOREIGN KEY (week_id) REFERENCES LOGBOEK_WEEK(week_id) ON DELETE CASCADE,
                FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE
            )
        `);
        console.log('  LOGBOEK_DAG: OK');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS LOGBOEK_COMPETENTIE (
                id INT AUTO_INCREMENT PRIMARY KEY,
                dag_id INT NOT NULL,
                student_id INT NOT NULL,
                competentie_id INT NOT NULL,
                score INT,
                commentaar TEXT,
                FOREIGN KEY (dag_id) REFERENCES LOGBOEK_DAG(dag_id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
                FOREIGN KEY (competentie_id) REFERENCES COMPETENTIE(competentie_id) ON DELETE CASCADE
            )
        `);
        console.log('  LOGBOEK_COMPETENTIE: OK');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS EVALUATIE (
                evaluatie_id INT AUTO_INCREMENT PRIMARY KEY,
                stage_id INT NOT NULL,
                beoordelaar_id INT NOT NULL,
                type ENUM('tussentijds','finaal') NOT NULL,
                datum DATE,
                feedback TEXT,
                beoordelaar_rol VARCHAR(50),
                FOREIGN KEY (stage_id) REFERENCES STAGE(stage_id) ON DELETE CASCADE,
                FOREIGN KEY (beoordelaar_id) REFERENCES GEBRUIKER(id) ON DELETE CASCADE
            )
        `);
        console.log('  EVALUATIE: OK');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS EVALUATIE_COMPETENTIE (
                id INT AUTO_INCREMENT PRIMARY KEY,
                evaluatie_id INT NOT NULL,
                competentie_id INT NOT NULL,
                score INT,
                commentaar TEXT,
                FOREIGN KEY (evaluatie_id) REFERENCES EVALUATIE(evaluatie_id) ON DELETE CASCADE,
                FOREIGN KEY (competentie_id) REFERENCES COMPETENTIE(competentie_id) ON DELETE CASCADE
            )
        `);
        console.log('  EVALUATIE_COMPETENTIE: OK');

        // Seed RUBRIEK data als er nog geen is
        const [rubRows] = await conn.query('SELECT COUNT(*) AS n FROM RUBRIEK');
        if (rubRows[0].n === 0) {
            const [comps] = await conn.query('SELECT competentie_id FROM COMPETENTIE');
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
                await conn.query(
                    'INSERT INTO RUBRIEK (competentie_id, punten, omschrijving) VALUES ?',
                    [rubrieken]
                );
                console.log('  RUBRIEK: ' + rubrieken.length + ' niveaus aangemaakt');
            }
        } else {
            console.log('  RUBRIEK: al gevuld, overgeslagen');
        }

        console.log('\nMigratie klaar! Herstart de backend: node server.js');
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate().catch(err => {
    console.error('FOUT:', err.message);
    process.exit(1);
});
