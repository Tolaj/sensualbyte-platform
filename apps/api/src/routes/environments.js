const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");
const { addOwnership, isOwnerOrAdmin } = require("../ownership");

const { requireAuth } = require("../middleware/authMiddleware");
const config = require("../config");
const provisioner = require("../../../provisioner");

const STORE = path.join(process.cwd(), "runtime", "environments.json");

function readStore() {
    if (!fs.existsSync(STORE)) return { environments: [] };
    return JSON.parse(fs.readFileSync(STORE, "utf-8"));
}

function writeStore(data) {
    fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
}

/**
 * LIST ENVIRONMENTS
 */
router.get("/", requireAuth(["super_admin", "admin"]), (req, res) => {
    const data = readStore();
    res.json(data.environments);
});

/**
 * CREATE ENVIRONMENT
 */
router.post("/", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const body = req.body || {};

    const cpu = Number(body.cpu || 1);
    const memoryMb = Number(body.memoryMb || 512);
    const image = body.image || "ubuntu:22.04";
    const username = body.username || config.SSH_USER;

    if (memoryMb < 256) {
        return res.status(400).json({ error: "memoryMb must be >= 256" });
    }

    const id = `env_${nanoid(10)}`;

    await provisioner.ensureNetwork(config.DOCKER_NETWORK);
    const containerName = await provisioner.createEnvironment(
        id,
        cpu,
        memoryMb,
        config.DOCKER_NETWORK,
        image,
        username
    );

    const ip = await provisioner.getContainerIP(containerName, config.DOCKER_NETWORK);

    const data = readStore();

    const projectId = body.projectId;
    if (!projectId) return res.status(400).json({ error: "projectId required" });


    const env = {
        id,
        projectId,
        containerName,
        cpu,
        memoryMb,
        network: config.DOCKER_NETWORK,
        ip,
        username,
        status: "running",
        ownerUserId: req.user.id,
        createdAt: new Date().toISOString()
    };

    data.environments.push(env);
    writeStore(data);
    addOwnership({
        resourceType: "environment",
        resourceId: id,
        ownerUserId: req.user.id,
        role: "owner"
    });

    res.json(env);
});

/**
 * DELETE ENVIRONMENT
 */
router.delete("/:id", requireAuth(["super_admin"]), async (req, res) => {
    const data = readStore();
    const idx = data.environments.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const env = data.environments[idx];

    if (!isOwnerOrAdmin(req.user, "environment", req.params.id)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await provisioner.removeContainer(env.containerName);

    data.environments.splice(idx, 1);
    writeStore(data);

    res.json({ ok: true });
});

module.exports = router;
