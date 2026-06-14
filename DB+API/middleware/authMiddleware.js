const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen token meegegeven' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Ongeldig of verlopen token' });
    }
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Niet ingelogd' });
        if (!roles.includes(req.user.rol)) return res.status(403).json({ error: 'Geen toegang voor jouw rol' });
        next();
    };
};

module.exports = { verifyToken, requireRole };
