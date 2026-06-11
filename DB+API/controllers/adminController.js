const UserModel = require('../models/userModel');

class AdminController {
    static async getAllUsers(req, res) {
        try {
            const users = await UserModel.findAll();
            res.json(users);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async getUserById(req, res) {
        try {
            const user = await UserModel.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ error: 'Gebruiker niet gevonden' });
            }
            res.json(user);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async createUser(req, res) {
        const { email, rol, naam, wachtwoord, studentnummer, opleiding, afdeling, bevoegdheidsniveau } = req.body;
        
        if (!email || !rol) {
            return res.status(400).json({ error: 'Email en rol zijn verplicht.' });
        }

        try {
            const finalNaam = naam || email.split('@')[0];
            const finalWachtwoord = wachtwoord || 'TijdelijkWachtwoord123';
            
            const newUser = await UserModel.create({
                naam: finalNaam,
                email,
                wachtwoord: finalWachtwoord,
                rol,
                studentnummer,
                opleiding,
                afdeling,
                bevoegdheidsniveau
            });
            
            res.status(201).json(newUser);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async updateUser(req, res) {
        const { naam, email, rol, studentnummer, opleiding, afdeling, bevoegdheidsniveau } = req.body;
        
        if (!naam || !email || !rol) {
            return res.status(400).json({ error: 'Naam, email en rol zijn verplicht.' });
        }

        try {
            const updatedUser = await UserModel.update(req.params.id, {
                naam,
                email,
                rol,
                studentnummer,
                opleiding,
                afdeling,
                bevoegdheidsniveau
            });
            res.json(updatedUser);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    static async deleteUser(req, res) {
        try {
            const deleted = await UserModel.delete(req.params.id);
            if (!deleted) {
                return res.status(404).json({ error: 'Gebruiker niet gevonden' });
            }
            res.json({ message: 'Gebruiker succesvol verwijderd.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = AdminController;
