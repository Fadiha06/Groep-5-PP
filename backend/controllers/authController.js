const db = require('../config/db');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const { stuurWachtwoordLink } = require('../util/mail');

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email en wachtwoord verplicht' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ongeldig e-mailadres' });
        }

        const users = await UserModel.findByEmail(email);
        if (users.length === 0) return res.status(401).json({ error: 'Ongeldige inloggegevens' });

        const user = users[0];

        const match = await argon2.verify(user.wachtwoord, password);
        if (!match) return res.status(401).json({ error: 'Ongeldige inloggegevens' });

        let redirect_url = '';
        if (user.rol === 'administrator' || user.rol === 'admin') {
            redirect_url = 'admin_panel.html';
        } else if (user.rol === 'student') {
            redirect_url = 'student_dashboard.html';
        } else if (user.rol === 'docent') {
            redirect_url = 'docent_dashboard.html';
        } else if (user.rol === 'commissie' || user.rol === 'stagecommissie') {
            redirect_url = 'commissie_dashboard.html';
        } else if (user.rol === 'mentor' || user.rol === 'stagementor') {
            redirect_url = 'mentor_dashboard.html';
        } else {
            redirect_url = 'index.html';
        }

        const token = jwt.sign(
            { id: user.id, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ message: 'Ingelogd', token, rol: user.rol, redirect_url, userId: user.id });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'E-mailadres is verplicht' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Ongeldig e-mailadres' });
        }

        const users = await UserModel.findByEmail(email);

        // Alleen een mail sturen als de gebruiker bestaat,
        // maar altijd dezelfde respons (geen e-mailadressen lekken).
        if (users.length > 0) {
            const user = users[0];
            const token = jwt.sign(
                { id: user.id, type: 'set_password' },
                process.env.JWT_SECRET || 'supersecret',
                { expiresIn: '15m' }
            );
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const link = `${frontendUrl}/set_password.html?token=${token}`;

            try {
                await stuurWachtwoordLink(email, link);
            } catch (mailError) {
                console.error('Reset-mail verzenden mislukt:', mailError);
            }
        }

        res.json({ message: 'Als dit e-mailadres bekend is, is er een resetlink verstuurd.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.setPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Verplichte velden ontbreken' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'set_password') return res.status(400).json({ error: 'Ongeldige token' });

        const hashedPassword = await argon2.hash(password);

        await db.query('UPDATE GEBRUIKER SET wachtwoord = ? WHERE id = ?', [hashedPassword, decoded.id]);

        res.json({ message: 'Wachtwoord succesvol ingesteld! Je kan nu inloggen.' });
    } catch (error) {
        console.error('Set password error:', error);
        res.status(400).json({ error: 'Ongeldige of verlopen token' });
    }
};