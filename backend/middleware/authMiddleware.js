const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Geen toegang (Geen geldige token)' });
    }

    const token = authHeader.split(' ')[1];

    try {
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is niet ingesteld');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

module.exports = { verifyToken, requireRole };