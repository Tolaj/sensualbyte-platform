// provisioner/src/drivers/docker/volumes.js
import { wrapErr, isNotFoundDockerErr } from "../../utils/errors.js";

export async function ensureVolume(docker, name, labels = {}) {
    if (!docker) throw new Error("docker client required");
    if (!name) throw new Error("volume name required");

    try {
        const v = docker.getVolume(name);
        await v.inspect();
        return v;
    } catch (err) {
        if (!isNotFoundDockerErr(err)) throw wrapErr("Failed to inspect volume", err, { name });

        try {
            return await docker.createVolume({ Name: name, Labels: labels });
        } catch (e2) {
            throw wrapErr("Failed to create volume", e2, { name });
        }
    }
}

export async function removeVolumeIfExists(docker, name) {
    if (!docker) throw new Error("docker client required");
    if (!name) throw new Error("volume name required");

    try {
        const v = docker.getVolume(name);
        await v.remove({ force: true });
        return { removed: true };
    } catch (err) {
        if (isNotFoundDockerErr(err)) return { removed: false, reason: "not_found" };

        // If volume is in use, surface clearly
        const msg = err?.json?.message || err?.message || "";
        if (/volume is in use|being used|has containers/i.test(msg)) {
            const e = wrapErr("Failed to remove volume (in use)", err, { name });
            e.statusCode = 409;
            throw e;
        }

        throw wrapErr("Failed to remove volume", err, { name });
    }
}
