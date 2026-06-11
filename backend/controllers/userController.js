const UserModel = require('../models/userModel');
const StudentModel = require('../models/studentModel');
const DocentModel = require('../models/docentModel');
const CommissieModel = require('../models/commissieModel');
const AdminModel = require('../models/adminModel');
const argon2 = require('argon2');

exports.createAccount = async (req, res) => {
    try {
        const { naam, email, rol } = req.body;
        if (!naam || !email || !rol) {
            return res.status(400).json({ error: 'Naam, email en rol zijn verplicht' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ongeldig e-mailadres' });
        }

        const defaultPasswordHash = await argon2.hash('test123');
        const rolFormatted = rol.toLowerCase();
        
        const gebruiker_id = await UserModel.createUser(naam, email, defaultPasswordHash, rolFormatted);

        if (rolFormatted === 'student') {
            await StudentModel.createProfile(gebruiker_id);
        } else if (rolFormatted === 'docent') {
            await DocentModel.createProfile(gebruiker_id);
        } else if (rolFormatted === 'commissie' || rolFormatted === 'stagecommissie') {
            await CommissieModel.createProfile(gebruiker_id);
        } else if (rolFormatted === 'administrator' || rolFormatted === 'admin') {
            await AdminModel.createProfile(gebruiker_id);
        }

        res.status(201).json({ message: 'Account aangemaakt met standaard wachtwoord: test123' });
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
