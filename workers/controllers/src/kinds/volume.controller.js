import { getDocker, ensureVolume, removeVolumeIfExists } from "@sensualbyte/provisioner";
import { setStatus } from "../common/status.js";

export async function reconcileVolume({ resource, statusRepo, obsCache }) {
    const docker = getDocker();
    const name = resource.spec?.name || `sb_vol_${resource.resourceId}`;

    if (resource.desiredState === "deleted") {
        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "deleting",
            message: "Deleting volume"
        });

        const r = await removeVolumeIfExists(docker, name);

        await setStatus(statusRepo, resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "ready",
            message: r.removed ? "Deleted" : "Already absent",
            details: { volume: name, deleted: true }
        });

        await obsCache.set(resource.resourceId, {
            kind: "volume",
            observedAt: new Date().toISOString(),
            actual: { deleted: true, volume: name }
        });

        return { statusApplied: true };
    }

    const v = await ensureVolume(docker, name, {
        "sensualbyte.kind": "volume",
        "sensualbyte.resourceId": resource.resourceId
    });

    const info = await v.inspect();

    await setStatus(statusRepo, resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: "Volume ready",
        details: { volume: info.Name }
    });

    await obsCache.set(resource.resourceId, {
        kind: "volume",
        observedAt: new Date().toISOString(),
        actual: { volume: info.Name }
    });

    return { statusApplied: true };
}
