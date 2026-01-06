// provisioner/src/drivers/docker/compute.js
import { ensureImage } from "./images.js";
import { computeLabels } from "./labels.js";
import { ensureNetwork } from "./networks.js";
import { wrapErr, isNotFoundDockerErr } from "../../utils/errors.js";

function containerName(resourceId) {
    return `sb_compute_${resourceId}`;
}

function envList(envObj) {
    return Object.entries(envObj || {}).map(([k, v]) => `${k}=${String(v)}`);
}

function buildPortBindings(spec) {
    const mode = spec.mode || "paas";
    const internalPort = spec.network?.internalPort || (mode === "iaas" ? 2222 : null);

    if (!internalPort) return { ExposedPorts: {}, PortBindings: {} };

    const key = `${internalPort}/tcp`;
    return {
        ExposedPorts: { [key]: {} },
        PortBindings: { [key]: [{ HostPort: "" }] } // random host port
    };
}

function buildResources(spec) {
    const cpu = spec.resources?.cpu; // number like 0.5, 1, 2
    const memoryMb = spec.resources?.memoryMb; // int

    const HostConfig = {};

    // Docker CPU quota: 1 CPU ~ 100000
    if (typeof cpu === "number" && cpu > 0) {
        HostConfig.CpuPeriod = 100000;
        HostConfig.CpuQuota = Math.floor(cpu * 100000);
    }

    if (typeof memoryMb === "number" && memoryMb > 0) {
        HostConfig.Memory = Math.floor(memoryMb * 1024 * 1024);
    }

    return HostConfig;
}

function buildBinds(spec) {
    // spec.volumes: [{ volumeName, containerPath, readOnly }]
    const vols = Array.isArray(spec.volumes) ? spec.volumes : [];
    const binds = [];
    for (const v of vols) {
        if (!v?.volumeName || !v?.containerPath) continue;
        const ro = v.readOnly ? ":ro" : "";
        binds.push(`${v.volumeName}:${v.containerPath}${ro}`);
    }
    return binds;
}

async function inspectIfExists(docker, name) {
    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        return { container: c, inspect: i };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { container: null, inspect: null };
        throw wrapErr("Failed to inspect container", err, { name });
    }
}

async function ensureConnectedToNetwork(docker, { netName, containerRef }) {
    // containerRef = container name OR container Id (both work)
    try {
        const net = docker.getNetwork(netName);
        await net.connect({ Container: containerRef });
        return { connected: true };
    } catch (err) {
        // Network truly missing
        if (isNotFoundDockerErr(err)) {
            throw wrapErr("Failed to connect container to network (not found)", err, { netName, containerRef });
        }

        // Safe toleration: already connected / already exists
        const msg = err?.json?.message || err?.message || "";
        if (/already exists|already connected/i.test(msg)) {
            return { connected: false, reason: "already_connected" };
        }

        throw wrapErr("Failed to connect container to network", err, { netName, containerRef });
    }
}

/**
 * ensureCompute:
 * - Creates container if missing
 * - Ensures it is connected to the desired network
 * - Does NOT start it (start/stop is controlled by worker reconcile)
 */
export async function ensureCompute(docker, resource) {
    if (!docker) throw new Error("docker client required");
    if (!resource?.resourceId) throw new Error("resource.resourceId required");

    const spec = resource.spec || {};
    const impl = spec.implementation || "docker";
    if (impl !== "docker") throw new Error("compute implementation not supported in v1 (only docker)");
    if (!spec.image) throw new Error("compute.spec.image is required");

    const name = containerName(resource.resourceId);

    // ensure image exists locally
    await ensureImage(docker, spec.image);

    // ensure network exists
    const netName = spec.network?.name || "sensualbyte_default";
    await ensureNetwork(docker, netName, {
        "sensualbyte.kind": "network",
        "sensualbyte.network": "bridge"
    });

    const existing = await inspectIfExists(docker, name);
    if (existing.container) {
        // If container exists, ensure it is connected to the desired network (idempotent)
        const networks = existing.inspect?.NetworkSettings?.Networks || {};
        const alreadyOnNet = Boolean(networks[netName]);
        if (!alreadyOnNet) {
            await ensureConnectedToNetwork(docker, { netName, containerRef: name });
        }
        return existing.container;
    }

    const { ExposedPorts, PortBindings } = buildPortBindings(spec);

    const hostCfg = {
        ...buildResources(spec),
        RestartPolicy: { Name: "unless-stopped" },
        Binds: buildBinds(spec),
        PortBindings
    };

    let c;
    try {
        c = await docker.createContainer({
            name,
            Image: spec.image,
            Env: envList(spec.env),
            Labels: computeLabels(resource),
            ExposedPorts,
            HostConfig: hostCfg
        });
    } catch (err) {
        throw wrapErr("Failed to create compute container", err, {
            name,
            image: spec.image,
            netName
        });
    }

    // connect to desired network (tolerates already-connected)
    await ensureConnectedToNetwork(docker, { netName, containerRef: name });

    return c;
}

export async function startIfNeeded(container) {
    try {
        const i = await container.inspect();
        if (!i.State?.Running) await container.start();
        return await container.inspect();
    } catch (err) {
        throw wrapErr("Failed to start compute container", err, {});
    }
}

export async function stopIfNeeded(container) {
    try {
        const i = await container.inspect();
        if (i.State?.Running) await container.stop({ t: 10 });
        return await container.inspect();
    } catch (err) {
        throw wrapErr("Failed to stop compute container", err, {});
    }
}

export async function removeComputeIfExists(docker, resourceId) {
    if (!docker) throw new Error("docker client required");
    if (!resourceId) throw new Error("resourceId required");

    const name = containerName(resourceId);

    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();

        if (i.State?.Running) {
            try {
                await c.stop({ t: 10 });
            } catch (err) {
                // If stop fails for non-notfound, surface it
                if (!isNotFoundDockerErr(err)) {
                    throw wrapErr("Failed to stop compute container before remove", err, { name });
                }
            }
        }

        await c.remove({ force: true });
        return { removed: true };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { removed: false, reason: "not_found" };
        throw wrapErr("Failed to remove compute container", err, { name, resourceId });
    }
}

export function extractObserved(inspect) {
    const containerName = inspect.Name?.replace(/^\//, "") || null;
    const containerId = inspect.Id || null;
    const state = inspect.State?.Status || "unknown";
    const running = Boolean(inspect.State?.Running);

    const networks = inspect.NetworkSettings?.Networks || {};
    const firstNet = Object.values(networks)[0];
    const ip = firstNet?.IPAddress || null;

    const ports = inspect.NetworkSettings?.Ports || {};
    return { containerId, containerName, state, running, ip, ports };
}
