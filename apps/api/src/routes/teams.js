const router = require("express").Router();
const { nanoid } = require("nanoid");

const { requireAuth } = require("../middleware/authMiddleware");
const { createTeam, getTeam } = require("../teams");

router.post("/", requireAuth(["super_admin", "admin"]), (req, res) => {
    const name = (req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });

    const team = createTeam({
        id: `team_${nanoid(8)}`,
        name,
        ownerUserId: req.user.id
    });

    res.json(team);
});

router.get("/:id", requireAuth(["super_admin", "admin", "team"]), (req, res) => {
    const team = getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: "not found" });
    res.json(team);
});

module.exports = router;
