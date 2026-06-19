// fixup_stages.js
// Draai dit EEN KEER als bestaande contracten al volledig getekend zijn maar stage.status niet 'actief' is.
// Gebruik: node fixup_stages.js

const pool = require('./config/db');

async function fixup() {
    console.log('Zoeken naar contracten die volledig getekend zijn maar stage nog niet actief...');

    const [rijen] = await pool.query(`
        SELECT c.contract_id, c.stage_id, s.status AS stage_status
        FROM CONTRACT c
        JOIN STAGE s ON s.stage_id = c.stage_id
        WHERE c.student_getekend = 1
          AND c.mentor_getekend = 1
          AND c.docent_getekend = 1
          AND s.status != 'actief'
    `);

    if (rijen.length === 0) {
        console.log('Niets te fixen - alles is al correct.');
    } else {
        console.log(`${rijen.length} contract(en) gevonden om te fixen...`);
        for (const rij of rijen) {
            await pool.query(`UPDATE STAGE SET status = 'actief' WHERE stage_id = ?`, [rij.stage_id]);
            await pool.query(`UPDATE CONTRACT SET getekend_op = COALESCE(getekend_op, CURRENT_TIMESTAMP) WHERE contract_id = ?`, [rij.contract_id]);
            console.log(`  Contract #${rij.contract_id} (stage #${rij.stage_id}) was '${rij.stage_status}' -> nu 'actief'`);
        }
        console.log('Klaar! Start de backend opnieuw met: node server.js');
    }

    process.exit(0);
}

fixup().catch(err => {
    console.error('FOUT:', err.message);
    process.exit(1);
});
