require('dotenv').config();
const pool = require('./config/db');

async function migrate() {
    console.log('Migration gestart...');
    const conn = await pool.getConnection();
    try {
        // Controleer en voeg ontbrekende kolommen toe aan CONTRACT
        const cols = [
            { name: 'student_handtekening', def: 'LONGTEXT' },
            { name: 'mentor_handtekening',  def: 'LONGTEXT' },
            { name: 'docent_handtekening',  def: 'LONGTEXT' },
            { name: 'docent_datum',         def: 'DATETIME' },
            { name: 'getekend_op',          def: 'DATETIME' },
            { name: 'student_getekend',     def: 'BOOLEAN DEFAULT FALSE' },
            { name: 'mentor_getekend',      def: 'BOOLEAN DEFAULT FALSE' },
            { name: 'docent_getekend',      def: 'BOOLEAN DEFAULT FALSE' },
        ];

        const [existing] = await conn.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CONTRACT'
        `);
        const existingNames = existing.map(r => r.COLUMN_NAME.toLowerCase());

        for (const col of cols) {
            if (!existingNames.includes(col.name.toLowerCase())) {
                console.log(`  ADD COLUMN ${col.name} ${col.def}`);
                await conn.query(`ALTER TABLE CONTRACT ADD COLUMN ${col.name} ${col.def}`);
            } else {
                console.log(`  OK: ${col.name} bestaat al`);
            }
        }

        // Vergroot max_allowed_packet instelling voor de sessie (voor grote handtekeningen)
        try {
            await conn.query("SET GLOBAL max_allowed_packet = 67108864"); // 64 MB
            console.log('  max_allowed_packet ingesteld op 64MB');
        } catch (e) {
            console.log('  (max_allowed_packet kon niet worden ingesteld — geen root-rechten, normaal op gedeelde DB)');
        }

        console.log('Migration klaar!');
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate().catch(err => {
    console.error('Migration mislukt:', err.message);
    process.exit(1);
});
