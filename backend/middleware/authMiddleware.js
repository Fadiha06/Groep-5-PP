const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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
