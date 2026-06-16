const db = require('./config/db');
const argon2 = require('argon2');
(async () => {
    const email = 'student@test.be';
    const hash = await argon2.hash('test123');
    // gebruiker
    let [u] = await db.query('SELECT id FROM GEBRUIKER WHERE email=?', [email]);
    let gid = u.length ? u[0].id : (await db.query('INSERT INTO GEBRUIKER (naam,email,wachtwoord,rol) VALUES (?,?,?,?)', ['Test Student', email, hash, 'student']))[0].insertId;
    await db.query('UPDATE GEBRUIKER SET wachtwoord=? WHERE id=?', [hash, gid]);
    // student
    let [s] = await db.query('SELECT student_id FROM STUDENT WHERE gebruiker_id=?', [gid]);
    let sid = s.length ? s[0].student_id : (await db.query('INSERT INTO STUDENT (gebruiker_id, studentnummer) VALUES (?,?)', [gid, 's123456']))[0].insertId;
    // bedrijf
    let [b] = await db.query("SELECT bedrijf_id FROM BEDRIJF WHERE naam='DemoBedrijf'");
    let bid = b.length ? b[0].bedrijf_id : (await db.query("INSERT INTO BEDRIJF (naam,stad,sector) VALUES ('DemoBedrijf','Brussel','IT')"))[0].insertId;
    // stage
    let [st] = await db.query('SELECT stage_id FROM STAGE WHERE student_id=?', [sid]);
    let stid = st.length ? st[0].stage_id : (await db.query("INSERT INTO STAGE (student_id,bedrijf_id,titel,startdatum,einddatum,status) VALUES (?,?,?,?,?,?)", [sid, bid, 'Ontwikkeling ticketingsysteem', '2026-06-15', '2026-09-07', 'goedgekeurd']))[0].insertId;
    // contract
    let [c] = await db.query('SELECT contract_id FROM CONTRACT WHERE stage_id=?', [stid]);
    if (!c.length) await db.query("INSERT INTO CONTRACT (stage_id, inhoud) VALUES (?, 'Stagecontract.')", [stid]);
    console.log('Klaar. Login: student@test.be / test123');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });