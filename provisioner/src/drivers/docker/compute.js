import { ensureImage } from "./images.js";
import { computeLabels } from "./labels.js";

function containerName(resourceId) { return `sb_compute_${resourceId}`; }
function envList(envObj) { return Object.entries(envObj || {}).map(([k, v]) => `${k}=${String(v)}`); }

function portConfig(spec) {
    const mode = spec.mode;
    const internalPort = spec.network?.internalPort || (mode === "iaas" ? 2222 : null);
    if (mode === "iaas" && internalPort) {
        const key = `${internalPort}/tcp`;
        return { ExposedPorts: { [key]: {} }, HostConfig: { PortBindings: { [key]: [{ HostPort: "" }] } } };
    }
    return { ExposedPorts: {}, HostConfig: {} };
}

export async function ensureCompute(docker, resource) {
    const spec = resource.spec || {};
    if ((spec.implementation || "docker") !== "docker") throw new Error("only docker v1");

    const name = containerName(resource.resourceId);

    let c = null;
    try { c = docker.getContainer(name); await c.inspect(); } catch (_) { c = null; }

    await ensureImage(docker, spec.image);

    if (!c) {
        const ports = portConfig(spec);
        c = await docker.createContainer({
            name,
            Image: spec.image,
            Env: envList(spec.env),
            Labels: computeLabels(resource),
            ExposedPorts: ports.ExposedPorts,
            HostConfig: { ...ports.HostConfig }
        });
    }
    return c;
}

export async function startIfNeeded(container) {
    const i = await container.inspect();
    if (!i.State?.Running) await container.start();
    return container.inspect();
}

export async function stopIfNeeded(container) {
    const i = await container.inspect();
    if (i.State?.Running) await container.stop({ t: 10 });
    return container.inspect();
}

export async function removeComputeIfExists(docker, resourceId) {
    const name = containerName(resourceId);
    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        if (i.State?.Running) await c.stop({ t: 10 });
        await c.remove({ force: true });
        return { removed: true };
    } catch (_) { return { removed: false }; }
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
