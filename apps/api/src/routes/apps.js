const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");
const { addOwnership, isOwnerOrAdmin } = require("../ownership");

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

    const runtime = body.runtime || "node";
    if (runtime !== "node") {
        return res.status(400).json({ error: "Only node runtime supported for now" });
    }


    await provisioner.ensureNetwork(config.DOCKER_NETWORK);
    const containerName = await provisioner.createContainer(id, cpu, memoryMb, config.DOCKER_NETWORK, image);

    // Optional: setup SSH in container (your current feature)
    await provisioner.setupSSH(containerName, sshUser);

    const ip = await provisioner.getContainerIP(containerName, config.DOCKER_NETWORK);
    // Health defaults (from labels we added in provisioner)
    const healthPath = "/health";

    const projectId = body.projectId;
    if (!projectId) return res.status(400).json({ error: "projectId required" });

    const data = readStore();
    const app = {
        id,
        projectId,
        name,
        image,
        runtime: "node",
        containerName,
        ip,
        internalPort: 3000,
        healthPath,
        health: {
            status: "unknown",
            lastCheckedAt: null,
            latencyMs: null,
            lastError: null
        },
        cpu,
        memoryMb,
        sshUser,
        status: "running",
        createdAt: new Date().toISOString()
    };

    data.apps.push(app);
    writeStore(data);

    addOwnership({
        resourceType: "app",
        resourceId: id,
        ownerUserId: req.user.id,
        role: "owner"
    });

    app.health = await provisioner.checkHealth(app);

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

    if (!isOwnerOrAdmin(req.user, "app", req.params.id)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await provisioner.removeContainer(app.containerName);

    data.apps.splice(idx, 1);
    writeStore(data);

    res.json({ ok: true });
});

router.get("/:id/logs", requireAuth(["super_admin", "admin", "team"]), async (req, res) => {
    const data = readStore();
    const app = data.apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Not found" });

    const tail = Number(req.query.tail || 200);
    const logs = await provisioner.getLogs(app.containerName, tail);
    res.json({ logs });
});

router.post("/:id/check-health", requireAuth(["super_admin", "admin", "team"]), async (req, res) => {
    const data = readStore();
    const app = data.apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: "Not found" });

    if (app.status !== "running") {
        app.health = {
            status: "unhealthy",
            lastCheckedAt: new Date().toISOString(),
            latencyMs: 0,
            lastError: "app not running"
        };
        writeStore(data);
        return res.json(app.health);
    }

    app.health = await provisioner.checkHealth(app);
    writeStore(data);

    res.json(app.health);
});


module.exports = router;
