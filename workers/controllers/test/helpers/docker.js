import { getDocker } from "@sensualbyte/provisioner";
import { waitPort } from "./waitPort.js";

export async function removeIfExists(name) {
    const docker = getDocker();
    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        if (i?.State?.Running) await c.stop({ t: 5 });
        await c.remove({ force: true });
    } catch (_) {
        // ignore
    }
}

export async function startMongo({ name, image = "mongo:7", host = "127.0.0.1" } = {}) {
    const docker = getDocker();
    const containerName = name || `sb-worker-test-mongo-${Date.now()}`;
    await removeIfExists(containerName);

    await docker.pull(image);

    const c = await docker.createContainer({
        name: containerName,
        Image: image,
        ExposedPorts: { "27017/tcp": {} },
        HostConfig: { PortBindings: { "27017/tcp": [{ HostPort: "" }] } }
    });

    await c.start();

    const inspect = await c.inspect();
    const hostPort = Number(inspect.NetworkSettings.Ports["27017/tcp"][0].HostPort);

    await waitPort(host, hostPort, { timeoutMs: 30000 });
    return { container: c, hostPort, containerName };
}

export async function startRedis({ name, image = "redis:7-alpine", host = "127.0.0.1" } = {}) {
    const docker = getDocker();
    const containerName = name || `sb-worker-test-redis-${Date.now()}`;
    await removeIfExists(containerName);

    await docker.pull(image);

    const c = await docker.createContainer({
        name: containerName,
        Image: image,
        ExposedPorts: { "6379/tcp": {} },
        HostConfig: { PortBindings: { "6379/tcp": [{ HostPort: "" }] } }
    });

    await c.start();

    const inspect = await c.inspect();
    const hostPort = Number(inspect.NetworkSettings.Ports["6379/tcp"][0].HostPort);

    await waitPort(host, hostPort, { timeoutMs: 20000 });
    return { container: c, hostPort, containerName };
}

export async function stopAndRemove(container) {
    try {
        const i = await container.inspect();
        if (i?.State?.Running) await container.stop({ t: 5 });
    } catch (_) { }
    try {
        await container.remove({ force: true });
    } catch (_) { }
}
