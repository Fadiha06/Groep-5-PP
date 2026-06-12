require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
    { id: 19, rol: 'docent' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
);

console.log(token);