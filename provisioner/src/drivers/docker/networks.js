// provisioner/src/drivers/docker/networks.js
import { wrapErr, isNotFoundDockerErr } from "../../utils/errors.js";

/**
 * Ensure a Docker network exists (bridge, attachable).
 * Idempotent: if it already exists, returns the existing network handle.
 */
export async function ensureNetwork(docker, name, labels = {}) {
    if (!docker) throw new Error("docker client required");
    if (!name) throw new Error("network name required");

    let nets;
    try {
        nets = await docker.listNetworks();
    } catch (err) {
        throw wrapErr("Failed to list docker networks", err);
    }

    const found = nets.find((n) => n.Name === name);
    if (found) return docker.getNetwork(found.Id);

    try {
        return await docker.createNetwork({
            Name: name,
            Driver: "bridge",
            Attachable: true,
            Labels: labels
        });
    } catch (err) {
        throw wrapErr("Failed to create docker network", err, { name });
    }
}

/**
 * Remove a Docker network if it exists.
 * Safe behavior:
 * - if not found => { removed:false, reason:"not_found" }
 * - if in use or other error => throws with context (full-fledged)
 */
export async function removeNetworkIfExists(docker, name) {
    if (!docker) throw new Error("docker client required");
    if (!name) throw new Error("network name required");

    let nets;
    try {
        nets = await docker.listNetworks();
    } catch (err) {
        throw wrapErr("Failed to list docker networks", err);
    }

    const found = nets.find((n) => n.Name === name);
    if (!found) return { removed: false, reason: "not_found" };

    try {
        const net = docker.getNetwork(found.Id);
        await net.remove();
        return { removed: true };
    } catch (err) {
        // Some daemons return 404 if deleted between list + remove
        if (isNotFoundDockerErr(err)) return { removed: false, reason: "not_found" };

        // If network is in use, expose that clearly
        const msg = err?.json?.message || err?.message || "";
        if (/has active endpoints|in use|being used/i.test(msg)) {
            const e = wrapErr("Failed to remove docker network (network in use)", err, { name });
            e.statusCode = 409;
            throw e;
        }

        throw wrapErr("Failed to remove docker network", err, { name });
    }
}
