const router = require("express").Router();

router.get("/", (req, res) => {
    res.json({ ok: true, service: "sensual-platform-api" });
});

module.exports = router;
