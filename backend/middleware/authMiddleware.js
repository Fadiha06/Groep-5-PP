const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Geen toegang (Geen geldige token)' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_12345');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Geen toegang (Token verlopen of ongeldig)' });
    }
};

const requireRole = (allowedRoles) => {
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