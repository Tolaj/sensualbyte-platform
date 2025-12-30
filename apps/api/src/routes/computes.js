const router = require("express").Router();
const path = require("path");
const { nanoid } = require("nanoid");

const { addOwnership, isOwnerOrAdmin } = require("../lib/ownership");
const { readJson, writeJson } = require("../lib/store");
const { requireAuth } = require("../middleware/authMiddleware");
const config = require("../config");

let provisioner;
try {
    provisioner = require("../../provisioner");
} catch {
    provisioner = require("../../../../provisioner");
}

const STORE = path.join(process.cwd(), "runtime", "computes.json");

function readStore() {
    return readJson(STORE, { computes: [] });
}

function writeStore(data) {
    writeJson(STORE, data);
}

/**
 * LIST COMPUTES
 */
router.get("/", requireAuth(["super_admin", "admin"]), (req, res) => {
    const data = readStore();
    res.json(data.computes);
});

/**
 * GET COMPUTE
 */
router.get("/:id", requireAuth(["super_admin", "admin"]), (req, res) => {
    const data = readStore();
    const compute = data.computes.find(c => c.id === req.params.id);
    if (!compute) return res.status(404).json({ error: "Not found" });
    res.json(compute);
});

/**
 * CREATE COMPUTE
 */
router.post("/", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const body = req.body || {};

    const cpu = Number(body.cpu || 1);
    const memoryMb = Number(body.memoryMb || 512);
    const image = body.image || "ubuntu:22.04";
    const username = body.username || config.SSH_USER;
    const projectId = body.projectId;

    if (!projectId) {
        return res.status(400).json({ error: "projectId required" });
    }

    if (memoryMb < 256) {
        return res.status(400).json({ error: "memoryMb must be >= 256" });
    }

    const computeId = `cmp_${nanoid(10)}`;

    await provisioner.core.ensureNetwork(config.DOCKER_NETWORK);

    const containerName = await provisioner.computes.create({
        computeId,
        cpu,
        memoryMb,
        network: config.DOCKER_NETWORK,
        image,
        username
    });

    const ip = await provisioner.core.getContainerIP(
        containerName,
        config.DOCKER_NETWORK
    );

    const data = readStore();

    const compute = {
        id: computeId,
        projectId,
        containerName,
        cpu,
        memoryMb,
        network: config.DOCKER_NETWORK,
        ip,
        username,
        status: "running",
        createdAt: new Date().toISOString()
    };

    data.computes.push(compute);
    writeStore(data);

    addOwnership({
        resourceType: "compute",
        resourceId: computeId,
        ownerUserId: req.user.id,
        role: "owner"
    });

    res.json(compute);
});

/**
 * STOP COMPUTE
 */
router.post("/:id/stop", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const data = readStore();
    const compute = data.computes.find(c => c.id === req.params.id);
    if (!compute) return res.status(404).json({ error: "Not found" });

    await provisioner.core.stopContainer(compute.containerName);
    compute.status = "stopped";
    writeStore(data);

    res.json({ ok: true });
});

/**
 * START COMPUTE
 */
router.post("/:id/start", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const data = readStore();
    const compute = data.computes.find(c => c.id === req.params.id);
    if (!compute) return res.status(404).json({ error: "Not found" });

    await provisioner.core.startContainer(compute.containerName);
    compute.status = "running";
    writeStore(data);

    res.json({ ok: true });
});

/**
 * DELETE COMPUTE
 */
router.delete("/:id", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const data = readStore();
    const idx = data.computes.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    if (!isOwnerOrAdmin(req.user, "compute", req.params.id)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const compute = data.computes[idx];
    await provisioner.core.removeContainer(compute.containerName);

    data.computes.splice(idx, 1);
    writeStore(data);

    res.json({ ok: true });
});

module.exports = router;
