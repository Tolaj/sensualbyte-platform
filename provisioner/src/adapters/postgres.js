import { ensureImage } from "../drivers/docker/images.js";
import { postgresLabels } from "../drivers/docker/labels.js";
import { ensureVolume } from "../drivers/docker/volumes.js";

function containerName(resourceId) { return `sb_postgres_${resourceId}`; }

export async function ensurePostgresContainer(docker, resource, password, volumeName) {
    const spec = resource.spec || {};
    const name = containerName(resource.resourceId);
    const image = `postgres:${spec.version || "16"}`;

    let c = null;
    try { c = docker.getContainer(name); await c.inspect(); } catch (_) { c = null; }

    await ensureImage(docker, image);
    await ensureVolume(docker, volumeName, { "sensual.kind": "volume", "sensual.resourceId": resource.resourceId });

    if (!c) {
        c = await docker.createContainer({
            name,
            Image: image,
            Env: [
                `POSTGRES_DB=${spec.dbName || "app"}`,
                `POSTGRES_USER=${spec.username || "app"}`,
                `POSTGRES_PASSWORD=${password}`
            ],
            Labels: postgresLabels(resource),
            HostConfig: {
                Binds: [`${volumeName}:/var/lib/postgresql/data`],
                PortBindings: { "5432/tcp": [{ HostPort: "" }] }
            },
            ExposedPorts: { "5432/tcp": {} }
        });
    }
    return c;
}

export async function startIfNeeded(container) {
    const i = await container.inspect();
    if (!i.State?.Running) await container.start();
    return container.inspect();
}

export async function removePostgresIfExists(docker, resourceId) {
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
    const running = Boolean(inspect.State?.Running);

    const networks = inspect.NetworkSettings?.Networks || {};
    const firstNet = Object.values(networks)[0];
    const ip = firstNet?.IPAddress || null;

    const ports = inspect.NetworkSettings?.Ports || {};
    const binding = ports["5432/tcp"]?.[0];
    const hostPort = binding?.HostPort ? Number(binding.HostPort) : null;

    return { containerId, containerName, running, ip, hostPort };
}
