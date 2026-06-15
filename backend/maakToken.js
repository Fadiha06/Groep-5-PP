require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('./config/db');

(async () => {
    const [rows] = await db.query("SELECT id FROM GEBRUIKER WHERE email = 'alex@student.ehb.be'");
    if (!rows.length) {
        console.log('❌ Alex niet gevonden — voer testdata in');
        process.exit(1);
    }
    const token = jwt.sign({ id: rows[0].id, rol: 'student' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log(token);
    process.exit(0);
})();
