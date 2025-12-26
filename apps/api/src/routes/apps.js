const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const { requireAuth } = require("../middleware/authMiddleware");
const config = require("../config");

const provisioner = require("../../../provisioner");

const STORE = path.join(process.cwd(), "runtime", "apps.json");

function readStore() {
    if (!fs.existsSync(STORE)) return { apps: [] };
    return JSON.parse(fs.readFileSync(STORE, "utf-8"));
}
function writeStore(data) {
    fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}

router.get("/", requireAuth(["super_admin", "admin", "team"]), async (req, res) => {
    const data = readStore();
    res.json(data.apps);
});

router.get("/:id", requireAuth(["super_admin", "admin", "team"]), async (req, res) => {
    const data = readStore();
    const app = data.apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Not found" });
    res.json(app);
});

/**
 * Create app (provision container)
 * Body:
 * { name, cpu, memoryMb, image, sshUser? }
 */
router.post("/", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const body = req.body || {};
    const name = (body.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });

    const cpu = Number(body.cpu || config.DEFAULT_CPU);
    const memoryMb = Number(body.memoryMb || config.DEFAULT_MEMORY_MB);
    const image = body.image || "ubuntu:22.04";
    const sshUser = body.sshUser || config.SSH_USER;

    if (memoryMb < 128) return res.status(400).json({ error: "memoryMb must be >= 128" });

    const id = `app_${nanoid(10)}`;

    await provisioner.ensureNetwork(config.DOCKER_NETWORK);
    const containerName = await provisioner.createContainer(id, cpu, memoryMb, config.DOCKER_NETWORK, image);

    // Optional: setup SSH in container (your current feature)
    await provisioner.setupSSH(containerName, sshUser);

    const ip = await provisioner.getContainerIP(containerName, config.DOCKER_NETWORK);

    const data = readStore();
    const app = {
        id,
        name,
        image,
        containerName,
        ip,
        cpu,
        memoryMb,
        sshUser,
        status: "running",
        createdAt: new Date().toISOString()
    };
    data.apps.push(app);
    writeStore(data);

    res.json(app);
});

router.post("/:id/stop", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const data = readStore();
    const app = data.apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Not found" });

    await provisioner.stopContainer(app.containerName);
    app.status = "stopped";
    writeStore(data);

    res.json({ ok: true });
});

router.post("/:id/start", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const data = readStore();
    const app = data.apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Not found" });

    await provisioner.startContainer(app.containerName);
    app.status = "running";
    writeStore(data);

    res.json({ ok: true });
});

router.delete("/:id", requireAuth(["super_admin"]), async (req, res) => {
    const data = readStore();
    const idx = data.apps.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const app = data.apps[idx];
    await provisioner.removeContainer(app.containerName);

    data.apps.splice(idx, 1);
    writeStore(data);

    res.json({ ok: true });
});

module.exports = router;
