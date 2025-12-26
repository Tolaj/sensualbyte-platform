const router = require("express").Router();
const { connectDB } = require("../db");
const { hashPassword } = require("../lib/auth");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/", requireAuth(["super_admin"]), async (req, res) => {
    const db = await connectDB();
    const users = await db.collection("users").find({}).project({ passwordHash: 0 }).toArray();
    res.json(users);
});

router.post("/", requireAuth(["super_admin"]), async (req, res) => {
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) return res.status(400).json({ error: "Missing fields" });

    const db = await connectDB();
    const exists = await db.collection("users").findOne({ email });
    if (exists) return res.status(409).json({ error: "User exists" });

    const passwordHash = await hashPassword(password);

    await db.collection("users").insertOne({
        email,
        passwordHash,
        role,
        active: true,
        createdAt: new Date()
    });

    res.json({ ok: true });
});

module.exports = router;
