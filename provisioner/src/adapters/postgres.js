// provisioner/src/adapters/postgres.js
import { ensureImage } from "../drivers/docker/images.js";
import { postgresLabels } from "../drivers/docker/labels.js";
import { ensureVolume } from "../drivers/docker/volumes.js";
import { wrapErr, isNotFoundDockerErr } from "../utils/errors.js";

function containerName(resourceId) {
    return `sb_postgres_${resourceId}`;
}

async function inspectIfExists(docker, name) {
    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        return { container: c, inspect: i };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { container: null, inspect: null };
        throw wrapErr("Failed to inspect postgres container", err, { name });
    }
}

/**
 * Ensures a postgres container exists (idempotent) and has volume attached.
 * Does NOT start automatically; start handled by startIfNeeded.
 */
export async function ensurePostgresContainer(docker, resource, passwordPlain, volumeName) {
    if (!docker) throw new Error("docker client required");
    if (!resource?.resourceId) throw new Error("resource.resourceId required");
    if (!passwordPlain) throw new Error("Postgres passwordPlain is required");
    if (!volumeName) throw new Error("volumeName required");

    const spec = resource.spec || {};
    const name = containerName(resource.resourceId);
    const image = `postgres:${spec.version || "16"}`;

    // image + volume
    await ensureImage(docker, image);
    await ensureVolume(docker, volumeName, {
        "sensualbyte.kind": "volume",
        "sensualbyte.resourceId": String(resource.resourceId),
        "sensualbyte.projectId": String(resource.projectId || ""),
        "sensualbyte.usage": "postgres_data"
    });

    const existing = await inspectIfExists(docker, name);
    if (existing.container) return existing.container;

    try {
        const c = await docker.createContainer({
            name,
            Image: image,
            Env: [
                `POSTGRES_DB=${spec.dbName || "app"}`,
                `POSTGRES_USER=${spec.username || "app"}`,
                `POSTGRES_PASSWORD=${passwordPlain}`
            ],
            Labels: postgresLabels(resource),
            HostConfig: {
                RestartPolicy: { Name: "unless-stopped" },
                Binds: [`${volumeName}:/var/lib/postgresql/data`],
                PortBindings: { "5432/tcp": [{ HostPort: "" }] }
            },
            ExposedPorts: { "5432/tcp": {} }
        });
        return c;
    } catch (err) {
        throw wrapErr("Failed to create postgres container", err, {
            name,
            image,
            volumeName,
            dbName: spec.dbName || "app",
            username: spec.username || "app"
        });
    }
}

export async function startIfNeeded(container) {
    try {
        const i = await container.inspect();
        if (!i.State?.Running) await container.start();
        return await container.inspect();
    } catch (err) {
        throw wrapErr("Failed to start postgres container", err);
    }
}

export async function removePostgresIfExists(docker, resourceId) {
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
                if (!isNotFoundDockerErr(err)) {
                    throw wrapErr("Failed to stop postgres container before remove", err, { name });
                }
            }
        }

        await c.remove({ force: true });
        return { removed: true };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { removed: false, reason: "not_found" };
        throw wrapErr("Failed to remove postgres container", err, { name, resourceId });
    }
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
