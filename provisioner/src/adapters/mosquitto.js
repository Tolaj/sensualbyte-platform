import { ensureImage } from "../drivers/docker/images.js";
import { ensureVolume } from "../drivers/docker/volumes.js";
import { ensureNetwork } from "../drivers/docker/networks.js";
import { baseLabels } from "../drivers/docker/labels.js";
import { wrapErr, isNotFoundDockerErr } from "../utils/errors.js";

function containerName(resourceId) {
    return `sb_mqtt_${resourceId}`;
}

function mqttLabels(resource) {
    return {
        ...baseLabels(resource),
        "sensual.mqtt.engine": "mosquitto"
    };
}

async function inspectIfExists(docker, name) {
    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        return { container: c, inspect: i };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { container: null, inspect: null };
        throw wrapErr("Failed to inspect mosquitto container", err, { name });
    }
}

function buildPorts(spec) {
    // internal container port (default 1883)
    const internalPort = Number(spec?.ports?.mqtt || 1883);
    const key = `${internalPort}/tcp`;
    return { internalPort, key };
}

/**
 * ensureMosquitto
 * spec example:
 * {
 *   version: "2",
 *   network: { name: "sensualbyte_default" },
 *   ports: { mqtt: 1883 },
 *   persistence: true
 * }
 */
export async function ensureMosquitto(docker, resource) {
    if (!docker) throw new Error("docker client required");
    if (!resource?.resourceId) throw new Error("resource.resourceId required");

    const spec = resource.spec || {};
    const name = containerName(resource.resourceId);

    const image = `eclipse-mosquitto:${spec.version || "2"}`;
    await ensureImage(docker, image);

    const netName = spec.network?.name || "sensualbyte_default";
    await ensureNetwork(docker, netName, {
        "sensual.kind": "network",
        "sensual.network": "bridge"
    });

    const existing = await inspectIfExists(docker, name);
    if (existing.container) return existing.container;

    const { key } = buildPorts(spec);

    const persistence = spec.persistence !== false; // default true
    const dataVol = `sb_mqttdata_${resource.resourceId}`;
    const logVol = `sb_mqttlog_${resource.resourceId}`;

    const binds = [];
    if (persistence) {
        await ensureVolume(docker, dataVol, {
            "sensual.kind": "volume",
            "sensual.resourceId": String(resource.resourceId),
            "sensual.usage": "mqtt_data"
        });
        await ensureVolume(docker, logVol, {
            "sensual.kind": "volume",
            "sensual.resourceId": String(resource.resourceId),
            "sensual.usage": "mqtt_log"
        });

        binds.push(`${dataVol}:/mosquitto/data`, `${logVol}:/mosquitto/log`);
    }

    try {
        const c = await docker.createContainer({
            name,
            Image: image,
            Labels: mqttLabels(resource),
            ExposedPorts: { [key]: {} },
            HostConfig: {
                RestartPolicy: { Name: "unless-stopped" },
                Binds: binds.length ? binds : undefined,
                PortBindings: { [key]: [{ HostPort: "" }] } // random host port
            }
        });

        // connect to desired network
        try {
            const net = docker.getNetwork(netName);
            await net.connect({ Container: name });
        } catch (err) {
            const msg = err?.json?.message || err?.message || "";
            if (!/already exists|already connected/i.test(msg)) {
                throw wrapErr("Failed to connect mosquitto to network", err, { netName, name });
            }
        }

        return c;
    } catch (err) {
        throw wrapErr("Failed to create mosquitto container", err, { name, image, netName });
    }
}

export async function startMosquitto(container) {
    try {
        const i = await container.inspect();
        if (!i.State?.Running) await container.start();
        return await container.inspect();
    } catch (err) {
        throw wrapErr("Failed to start mosquitto", err);
    }
}

export async function stopMosquitto(container) {
    try {
        const i = await container.inspect();
        if (i.State?.Running) await container.stop({ t: 10 });
        return await container.inspect();
    } catch (err) {
        throw wrapErr("Failed to stop mosquitto", err);
    }
}

export async function removeMosquittoIfExists(docker, resourceId, opts = {}) {
    const name = containerName(resourceId);
    const removeVolumes = Boolean(opts.removeVolumes);

    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        if (i.State?.Running) await c.stop({ t: 10 });
        await c.remove({ force: true });

        // optional: remove persistence volumes (safe best-effort)
        if (removeVolumes) {
            const dataVol = docker.getVolume(`sb_mqttdata_${resourceId}`);
            const logVol = docker.getVolume(`sb_mqttlog_${resourceId}`);
            try { await dataVol.remove({ force: true }); } catch (_) { }
            try { await logVol.remove({ force: true }); } catch (_) { }
        }

        return { removed: true };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { removed: false };
        throw wrapErr("Failed to remove mosquitto", err, { name });
    }
}

export function extractMosquittoObserved(inspect) {
    const containerName = inspect.Name?.replace(/^\//, "") || null;
    const containerId = inspect.Id || null;
    const running = Boolean(inspect.State?.Running);

    const networks = inspect.NetworkSettings?.Networks || {};
    const firstNet = Object.values(networks)[0];
    const ip = firstNet?.IPAddress || null;

    // Find host port for 1883 or whatever internal port is exposed
    const ports = inspect.NetworkSettings?.Ports || {};
    let hostPort = null;
    for (const [k, bindings] of Object.entries(ports)) {
        if (!Array.isArray(bindings) || bindings.length === 0) continue;
        // prefer mqtt default
        if (k.endsWith("/tcp")) {
            const b = bindings[0];
            if (b?.HostPort) {
                hostPort = Number(b.HostPort);
                // if it's 1883/tcp, stop searching
                if (k.startsWith("1883/")) break;
            }
        }
    }

    return { containerId, containerName, running, ip, hostPort, ports };
}
