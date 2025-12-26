const router = require("express").Router();
const { connectDB } = require("../db");
const { verifyPassword, generateToken } = require("../auth");

router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing credentials" });

    const db = await connectDB();
    const user = await db.collection("users").findOne({ email, active: true });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(user);
    res.json({ token, user: { email: user.email, role: user.role } });
});

module.exports = router;
