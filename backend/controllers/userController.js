const UserModel = require('../models/userModel');
const StudentModel = require('../models/studentModel');
const DocentModel = require('../models/docentModel');
const CommissieModel = require('../models/commissieModel');
const AdminModel = require('../models/adminModel');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { stuurWachtwoordLink } = require('../util/mail');

exports.createAccount = async (req, res) => {
    try {
        const { voornaam, achternaam, email, rol } = req.body;
        if (!voornaam || !achternaam || !email || !rol) {
            return res.status(400).json({ error: 'Voornaam, achternaam, email en rol zijn verplicht' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ongeldig e-mailadres' });
        }

        const defaultPasswordHash = await argon2.hash(require('crypto').randomBytes(32));
        const rolFormatted = rol.toLowerCase();
        
        const gebruiker_id = await UserModel.createUser(voornaam, achternaam, email, defaultPasswordHash, rolFormatted);

        if (rolFormatted === 'student') {
            await StudentModel.createProfile(gebruiker_id);
        } else if (rolFormatted === 'docent') {
            await DocentModel.createProfile(gebruiker_id);
        } else if (rolFormatted === 'commissie' || rolFormatted === 'stagecommissie') {
            await CommissieModel.createProfile(gebruiker_id);
        } else if (rolFormatted === 'administrator' || rolFormatted === 'admin') {
            await AdminModel.createProfile(gebruiker_id);
        } else if (rolFormatted === 'mentor' || rolFormatted === 'stagementor') {
            const MentorModel = require('../models/mentorModel');
            await MentorModel.createProfile(gebruiker_id);
        }

        // Genereer reset token voor het nieuwe account
        const token = jwt.sign(
            { id: gebruiker_id, type: 'set_password' },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        // Link bouwen voor de frontend
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = `${frontendUrl}/set_password.html?token=${token}`;

        // Verificatiemail sturen
        try {
            await stuurWachtwoordLink(email, link);
        } catch (mailError) {
            console.error('Mail verzenden mislukt:', mailError);
            return res.status(201).json({ message: 'Account aangemaakt, maar de verificatie-mail kon niet worden verzonden. Controleer je SMTP instellingen.' });
        }

        res.status(201).json({ message: 'Account aangemaakt. Er is een verificatie-mail verzonden.', id: gebruiker_id });
    } catch (error) {
        console.error('Error creating account:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'E-mailadres bestaat al' });
        }
        res.status(500).json({ error: 'Fout bij aanmaken account' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await UserModel.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Fout bij het ophalen van gebruikers' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user && parseInt(req.user.id, 10) === parseInt(userId, 10)) {
            return res.status(400).json({ error: 'Je kan jezelf niet verwijderen.' });
        }
        const deleted = await UserModel.deleteUser(userId);
        if (!deleted) {
            return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        }
        res.json({ message: 'Gebruiker succesvol verwijderd' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Fout bij verwijderen gebruiker' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { rol, status } = req.body;
        
        if (!rol) {
            return res.status(400).json({ error: 'Rol is verplicht bij updaten' });
        }
        
        const rolFormatted = rol.toLowerCase();
        const updatedStatus = status || 'Actief';
        
        const users = await UserModel.findById(userId);
        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        }
        const currentRol = users[0].rol.toLowerCase();

        if (currentRol !== rolFormatted) {
            const db = require('../config/db');
            if (currentRol === 'student') await db.query('DELETE FROM STUDENT WHERE gebruiker_id = ?', [userId]);
            else if (currentRol === 'docent') await db.query('DELETE FROM DOCENT WHERE gebruiker_id = ?', [userId]);
            else if (currentRol === 'commissie' || currentRol === 'stagecommissie') await db.query('DELETE FROM STAGECOMMISSIE WHERE gebruiker_id = ?', [userId]);
            else if (currentRol === 'administrator' || currentRol === 'admin') await db.query('DELETE FROM ADMINISTRATIE WHERE gebruiker_id = ?', [userId]);
            else if (currentRol === 'mentor' || currentRol === 'stagementor') await db.query('DELETE FROM STAGEMENTOR WHERE gebruiker_id = ?', [userId]);

            if (rolFormatted === 'student') await StudentModel.createProfile(userId);
            else if (rolFormatted === 'docent') await DocentModel.createProfile(userId);
            else if (rolFormatted === 'commissie' || rolFormatted === 'stagecommissie') await CommissieModel.createProfile(userId);
            else if (rolFormatted === 'administrator' || rolFormatted === 'admin') await AdminModel.createProfile(userId);
            else if (rolFormatted === 'mentor' || rolFormatted === 'stagementor') {
                const MentorModel = require('../models/mentorModel');
                await MentorModel.createProfile(userId);
            }
        }
        
        await UserModel.updateUser(userId, rolFormatted, updatedStatus);
        
        res.json({ message: 'Gebruiker succesvol bijgewerkt' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Fout bij bewerken gebruiker' });
    }
};
    
