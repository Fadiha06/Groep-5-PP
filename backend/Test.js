require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
    { id: 1, email: 'test@test.com', rol: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
);

console.log(token);