import {
    getDocker,
    ensureMosquitto,
    startMosquitto,
    stopMosquitto,
    removeMosquittoIfExists,
    extractMosquittoObserved
} from "@sensualbyte/provisioner";

import { setStatus } from "../common/status.js";

export async function reconcileMqtt({ resource, statusRepo, obsCache }) {
    const docker = getDocker();

    if (resource.desiredState === "deleted") {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "deleting",
            message: "Deleting MQTT"
        });

        const r = await removeMosquittoIfExists(docker, resource.resourceId);

        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "ready",
            message: r.removed ? "Deleted" : "Already absent",
            details: { deleted: true }
        });

        await obsCache.set(resource.resourceId, {
            kind: "mqtt",
            observedAt: new Date().toISOString(),
            actual: { deleted: true }
        });

        return { statusApplied: true };
    }

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "creating",
        message: "Reconciling MQTT"
    });

    const c = await ensureMosquitto(docker, resource);

    const inspect =
        resource.desiredState === "paused"
            ? await stopMosquitto(c)
            : await startMosquitto(c);

    const observed = extractMosquittoObserved(inspect);

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: resource.desiredState === "paused" ? "MQTT stopped" : "MQTT running",
        details: { lastKnown: observed }
    });

    await obsCache.set(resource.resourceId, {
        kind: "mqtt",
        observedAt: new Date().toISOString(),
        actual: observed
    });

    return { statusApplied: true };
}
