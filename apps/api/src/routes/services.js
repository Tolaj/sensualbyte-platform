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
} catch (err) {
    provisioner = require("../../../../provisioner");
}

const STORE = path.join(process.cwd(), "runtime", "services.json");

function readStore() {
    return readJson(STORE, { services: [] });
}

function writeStore(data) {
    writeJson(STORE, data);
}

/**
 * LIST SERVICES
 */
router.get("/", requireAuth(["super_admin", "admin", "team"]), (req, res) => {
    const data = readStore();
    res.json(data.services);
});

/**
 * GET SERVICE
 */
router.get("/:id", requireAuth(["super_admin", "admin", "team"]), (req, res) => {
    const data = readStore();
    const svc = data.services.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: "Not found" });
    res.json(svc);
});

/**
 * CREATE SERVICE
 */
router.post("/", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const body = req.body || {};
    const name = (body.name || "").trim();
    const projectId = body.projectId;

    if (!name) return res.status(400).json({ error: "name required" });
    if (!projectId) return res.status(400).json({ error: "projectId required" });

    const cpu = Number(body.cpu || config.DEFAULT_CPU);
    const memoryMb = Number(body.memoryMb || config.DEFAULT_MEMORY_MB);
    const image = body.image || "node:20-alpine";

    const internalPort = Number(body.internalPort || 3000);
    const healthPath = (body.healthPath || "/health").trim();


    if (memoryMb < 128) {
        return res.status(400).json({ error: "memoryMb must be >= 128" });
    }

    const serviceId = `svc_${nanoid(10)}`;

    await provisioner.core.ensureNetwork(config.DOCKER_NETWORK);

    const containerName = await provisioner.services.create({
        serviceId,
        image,
        cpu,
        memoryMb,
        network: config.DOCKER_NETWORK,
        internalPort,
        healthPath
    });

    const ip = await provisioner.core.getContainerIP(
        containerName,
        config.DOCKER_NETWORK
    );

    const data = readStore();

    const service = {
        id: serviceId,
        projectId,
        name,
        image,
        containerName,
        ip,
        internalPort,
        healthPath,
        cpu,
        memoryMb,
        status: "running",
        createdAt: new Date().toISOString(),
        health: {
            status: "unknown",
            lastCheckedAt: null,
            latencyMs: null,
            lastError: null
        }
    };

    data.services.push(service);
    writeStore(data);

    addOwnership({
        resourceType: "service",
        resourceId: serviceId,
        ownerUserId: req.user.id,
        role: "owner"
    });

    service.health = await provisioner.services.health(service);

    res.json(service);
});

/**
 * STOP SERVICE
 */
router.post("/:id/stop", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const data = readStore();
    const svc = data.services.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: "Not found" });

    await provisioner.core.stopContainer(svc.containerName);
    svc.status = "stopped";
    writeStore(data);

    res.json({ ok: true });
});

/**
 * START SERVICE
 */
router.post("/:id/start", requireAuth(["super_admin", "admin"]), async (req, res) => {
    const data = readStore();
    const svc = data.services.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: "Not found" });

    await provisioner.core.startContainer(svc.containerName);
    svc.status = "running";
    writeStore(data);

    res.json({ ok: true });
});

/**
 * DELETE SERVICE
 */
router.delete("/:id", requireAuth(["super_admin"]), async (req, res) => {
    const data = readStore();
    const idx = data.services.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    if (!isOwnerOrAdmin(req.user, "service", req.params.id)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const svc = data.services[idx];
    await provisioner.core.removeContainer(svc.containerName);

    data.services.splice(idx, 1);
    writeStore(data);

    res.json({ ok: true });
});

/**
 * SERVICE LOGS
 */
router.get("/:id/logs", requireAuth(["super_admin", "admin", "team"]), async (req, res) => {
    const data = readStore();
    const svc = data.services.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: "Not found" });

    const tail = Number(req.query.tail || 200);
    const logs = await provisioner.services.logs(svc.containerName, tail);

    res.json({ logs });
});

/**
 * SERVICE HEALTH CHECK
 */
router.post("/:id/check-health", requireAuth(["super_admin", "admin", "team"]), async (req, res) => {
    const data = readStore();
    const svc = data.services.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: "Not found" });

    svc.health = await provisioner.services.health(svc);
    writeStore(data);

    res.json(svc.health);
});

module.exports = router;
