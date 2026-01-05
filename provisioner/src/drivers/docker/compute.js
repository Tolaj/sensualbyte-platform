import { computeLabels } from "./labels.js";
import { ensureImage } from "./images.js";

function containerName(resourceId) {
    return `sb_compute_${resourceId}`;
}

function buildEnv(envObj) {
    const env = envObj || {};
    return Object.entries(env).map(([k, v]) => `${k}=${String(v)}`);
}

function buildPortBindings(spec) {
    // For SSH box / iaas: expose container internalPort (default 2222) -> random host port
    // For paas: we generally don't publish ports directly (nginx route will later), but ok to omit
    const network = spec.network || {};
    const mode = spec.mode;

    if (mode === "iaas") {
        const internalPort = network.internalPort || 2222;
        const key = `${internalPort}/tcp`;
        return {
            ExposedPorts: { [key]: {} },
            HostConfig: {
                PortBindings: {
                    [key]: [{ HostPort: "" }] // Docker assigns a random available host port
                }
            }
        };
    }

    return { ExposedPorts: {}, HostConfig: {} };
}

export async function ensureCompute(docker, resource) {
    const spec = resource.spec || {};
    if ((spec.implementation || "docker") !== "docker") {
        throw new Error(`compute.spec.implementation=${spec.implementation} not supported in v1`);
    }

    const name = containerName(resource.resourceId);

    // find existing
    let container = null;
    try {
        container = docker.getContainer(name);
        await container.inspect(); // will throw if not found
    } catch (_) {
        container = null;
    }

    // ensure image exists locally
    await ensureImage(docker, spec.image);

    if (!container) {
        const portCfg = buildPortBindings(spec);

        const created = await docker.createContainer({
            name,
            Image: spec.image,
            Env: buildEnv(spec.env),
            Labels: computeLabels(resource),
            // NOTE: mounts/volumes will be added in Step 4/5 with volume controller
            ExposedPorts: portCfg.ExposedPorts,
            HostConfig: {
                ...portCfg.HostConfig
            }
        });

        container = created;
    }

    return container;
}

export async function startIfNeeded(container) {
    const info = await container.inspect();
    if (!info.State.Running) {
        await container.start();
    }
    return container.inspect();
}

export async function stopIfNeeded(container) {
    const info = await container.inspect();
    if (info.State.Running) {
        await container.stop({ t: 10 });
    }
    return container.inspect();
}

export async function removeIfExists(docker, resourceId) {
    const name = containerName(resourceId);
    try {
        const c = docker.getContainer(name);
        const info = await c.inspect();
        if (info.State.Running) {
            await c.stop({ t: 10 });
        }
        await c.remove({ force: true });
        return { removed: true };
    } catch (_) {
        return { removed: false };
    }
}

export async function inspectCompute(container) {
    return container.inspect();
}

export function extractObserved(inspect) {
    const name = inspect.Name?.replace(/^\//, "") || null;
    const containerId = inspect.Id || null;
    const state = inspect.State?.Status || "unknown";
    const running = Boolean(inspect.State?.Running);

    // Best-effort IP (bridge network)
    const networks = inspect.NetworkSettings?.Networks || {};
    const firstNet = Object.values(networks)[0];
    const ip = firstNet?.IPAddress || null;

    // Published ports (useful for SSH box)
    const ports = inspect.NetworkSettings?.Ports || {};

    return {
        containerId,
        containerName: name,
        state,
        running,
        ip,
        ports
    };
}
