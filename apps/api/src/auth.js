const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function generateToken(user) {
    // Keep payload minimal
    return jwt.sign(
        { id: user._id?.toString?.() || user.id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken };
