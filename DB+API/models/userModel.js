const pool = require('../config/db');
const argon2 = require('argon2');

class UserModel {
    static async create(userData) {
        const { naam, email, wachtwoord, rol, studentnummer, opleiding, afdeling, bevoegdheidsniveau } = userData;
        const hashedWachtwoord = await argon2.hash(wachtwoord);
        
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // 1. Voeg basisgegevens toe aan GEBRUIKER tabel
            const [userResult] = await connection.query(
                'INSERT INTO GEBRUIKER (naam, email, wachtwoord, rol) VALUES (?, ?, ?, ?)',
                [naam, email, hashedWachtwoord, rol]
            );
            const gebruikerId = userResult.insertId;
            
            // 2. Voeg rolspecifieke gegevens toe op basis van de rol
            if (rol === 'student') {
                await connection.query(
                    'INSERT INTO STUDENT (gebruiker_id, studentnummer, opleiding) VALUES (?, ?, ?)',
                    [gebruikerId, studentnummer || null, opleiding || null]
                );
            } else if (rol === 'docent') {
                await connection.query(
                    'INSERT INTO DOCENT (gebruiker_id, afdeling) VALUES (?, ?)',
                    [gebruikerId, afdeling || null]
                );
            } else if (rol === 'stagecommissie') {
                await connection.query(
                    'INSERT INTO STAGECOMMISSIE (gebruiker_id) VALUES (?)',
                    [gebruikerId]
                );
            } else if (rol === 'admin') {
                await connection.query(
                    'INSERT INTO ADMINISTRATIE (gebruiker_id, bevoegdheidsniveau) VALUES (?, ?)',
                    [gebruikerId, bevoegdheidsniveau || null]
                );
            }
            
            await connection.commit();
            return { id: gebruikerId, naam, email, rol };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findById(id) {
        const query = `
            SELECT 
                g.id, g.naam, g.email, g.rol,
                s.studentnummer, s.opleiding,
                d.afdeling AS docent_afdeling,
                a.bevoegdheidsniveau AS admin_bevoegdheidsniveau
            FROM GEBRUIKER g
            LEFT JOIN STUDENT s ON g.id = s.gebruiker_id
            LEFT JOIN DOCENT d ON g.id = d.gebruiker_id
            LEFT JOIN ADMINISTRATIE a ON g.id = a.gebruiker_id
            WHERE g.id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        return rows[0] || null;
    }

    static async findAll() {
        const query = `
            SELECT 
                g.id, g.naam, g.email, g.rol,
                s.studentnummer, s.opleiding,
                d.afdeling AS docent_afdeling,
                a.bevoegdheidsniveau AS admin_bevoegdheidsniveau
            FROM GEBRUIKER g
            LEFT JOIN STUDENT s ON g.id = s.gebruiker_id
            LEFT JOIN DOCENT d ON g.id = d.gebruiker_id
            LEFT JOIN ADMINISTRATIE a ON g.id = a.gebruiker_id
            ORDER BY g.id DESC
        `;
        const [rows] = await pool.query(query);
        return rows;
    }

    static async update(id, userData) {
        const { naam, email, rol, studentnummer, opleiding, afdeling, bevoegdheidsniveau } = userData;
        
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // 1. Update GEBRUIKER tabel
            await connection.query(
                'UPDATE GEBRUIKER SET naam = ?, email = ?, rol = ? WHERE id = ?',
                [naam, email, rol, id]
            );
            
            // 2. Verwijder eventuele oude rolspecifieke records (als de rol is gewijzigd)
            await connection.query('DELETE FROM STUDENT WHERE gebruiker_id = ?', [id]);
            await connection.query('DELETE FROM DOCENT WHERE gebruiker_id = ?', [id]);
            await connection.query('DELETE FROM STAGECOMMISSIE WHERE gebruiker_id = ?', [id]);
            await connection.query('DELETE FROM ADMINISTRATIE WHERE gebruiker_id = ?', [id]);
            
            // 3. Voeg de nieuwe rolspecifieke gegevens toe
            if (rol === 'student') {
                await connection.query(
                    'INSERT INTO STUDENT (gebruiker_id, studentnummer, opleiding) VALUES (?, ?, ?)',
                    [id, studentnummer || null, opleiding || null]
                );
            } else if (rol === 'docent') {
                await connection.query(
                    'INSERT INTO DOCENT (gebruiker_id, afdeling) VALUES (?, ?)',
                    [id, afdeling || null]
                );
            } else if (rol === 'stagecommissie') {
                await connection.query(
                    'INSERT INTO STAGECOMMISSIE (gebruiker_id) VALUES (?)',
                    [id]
                );
            } else if (rol === 'admin') {
                await connection.query(
                    'INSERT INTO ADMINISTRATIE (gebruiker_id, bevoegdheidsniveau) VALUES (?, ?)',
                    [id, bevoegdheidsniveau || null]
                );
            }
            
            await connection.commit();
            return { id, naam, email, rol };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async delete(id) {
        // Door ON DELETE CASCADE in de database-tabellen verwijdert dit automatisch 
        // de gekoppelde records in STUDENT, DOCENT, STAGECOMMISSIE en ADMINISTRATIE.
        const [result] = await pool.query('DELETE FROM GEBRUIKER WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = UserModel;