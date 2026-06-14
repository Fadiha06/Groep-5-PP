const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Geen toegang (Geen geldige token)' });
    }

    if (!token) {
        return res.status(401).json({ error: 'Geen toegangstoken verstrekt. Log in om toegang te krijgen.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
        req.user = decoded; 
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Ongeldig of verlopen token.' });
    }
};

exports.requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.rol) {
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        }
        const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        if (!rolesArray.includes(req.user.rol) && !(rolesArray.includes('admin') && req.user.rol === 'administrator')) {
            return res.status(403).json({ error: `Toegang geweigerd. Vereiste rol: ${rolesArray.join(' of ')}` });
        }
        next();
    };
};

// Default-export = verifyToken (voor `const auth = require(...)`)
// + named exports voor `const { verifyToken, requireRole } = require(...)`
module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.requireRole = requireRole;
