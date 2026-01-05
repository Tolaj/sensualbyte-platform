import {
    getDocker,
    ensureCompute,
    startIfNeeded,
    stopIfNeeded,
    removeIfExists,
    inspectCompute,
    extractObserved
} from "../../../../provisioner/src/index.js";

export async function reconcileCompute({ resource, statusRepo, obsCache }) {
    const desired = resource.desiredState;
    const docker = getDocker();

    // DELETED => remove and mark status
    if (desired === "deleted") {
        await statusRepo.upsert(resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "deleting",
            message: "Deleting compute",
            lastUpdatedAt: new Date()
        });

        const result = await removeIfExists(docker, resource.resourceId);

        await statusRepo.upsert(resource.resourceId, {
            observedGeneration: resource.generation || 0,
            state: "ready",
            message: result.removed ? "Deleted" : "Already absent",
            details: { deleted: true },
            lastUpdatedAt: new Date()
        });

        await obsCache.set(resource.resourceId, {
            kind: "compute",
            observedAt: new Date().toISOString(),
            actual: { state: "deleted" }
        });

        return;
    }

    // ACTIVE/PAUSED => ensure container exists
    await statusRepo.upsert(resource.resourceId, {
        state: "creating",
        message: "Reconciling compute",
        lastUpdatedAt: new Date()
    });

    const container = await ensureCompute(docker, resource);

    let inspect;
    if (desired === "paused") {
        inspect = await stopIfNeeded(container);
    } else {
        inspect = await startIfNeeded(container);
    }

    // extract runtime state
    const observed = extractObserved(inspect);

    // If iaas, find assigned host ssh port (published port)
    let ssh = null;
    if ((resource.spec?.mode || "") === "iaas") {
        const internal = (resource.spec?.network?.internalPort || 2222) + "/tcp";
        const binding = observed.ports?.[internal]?.[0];
        if (binding?.HostPort) {
            ssh = {
                host: process.env.SSH_HOST || "localhost",
                port: Number(binding.HostPort)
            };
        }
    }

    const readyState = desired === "paused" ? "stopped" : "running";

    await statusRepo.upsert(resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: `Compute ${readyState}`,
        details: {
            lastKnown: observed,
            ssh
        },
        lastUpdatedAt: new Date()
    });

    await obsCache.set(resource.resourceId, {
        kind: "compute",
        observedAt: new Date().toISOString(),
        actual: observed,
        ssh
    });
}
