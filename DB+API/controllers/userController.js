const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

// POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' });
    }

    try {
        const gebruiker = await userModel.findByEmail(email);
        if (!gebruiker) {
            return res.status(401).json({ error: 'Ongeldig email of wachtwoord' });
        }

        const isGeldig = await argon2.verify(gebruiker.wachtwoord, password);
            if (!isGeldig) {
                return res.status(401).json({ error: 'Ongeldig email of wachtwoord' });
            }

        const token = jwt.sign(
            { id: gebruiker.id, email: gebruiker.email, rol: gebruiker.rol },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            token,
            user: {
                id: gebruiker.id,
                naam: gebruiker.naam,
                email: gebruiker.email,
                rol: gebruiker.rol
            }
        });
  } 
  catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Serverfout bij inloggen' });
  }
};

// POST /api/auth/register
const register = async (req, res) => {
    const { naam, email, password, rol } = req.body;
    const toegestaneRollen = ['student', 'docent', 'mentor', 'stagecommissie', 'admin'];

    if (!naam || !email || !password || !rol) {
        return res.status(400).json({ error: 'Alle velden zijn verplicht' });
    }

    if (!toegestaneRollen.includes(rol)) {
        return res.status(400).json({ error: `Ongeldige rol. Kies uit: ${toegestaneRollen.join(', ')}` });
    }

    try {
        const bestaand = await userModel.findByEmail(email);
        if (bestaand) {
            return res.status(409).json({ error: 'Email is al in gebruik' });
        }

        const hash = await argon2.hash(password);
        const id = await userModel.create(naam, email, hash, rol);

        res.status(201).json({ message: 'Gebruiker aangemaakt', id });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout bij registreren' });
    }
};

// GET /api/auth/me
const me = async (req, res) => {
    try {
        const gebruiker = await userModel.findById(req.user.id);
        if (!gebruiker) {
            return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        }
        res.json(gebruiker);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfout' });
    }
};

module.exports = { login, register, me };