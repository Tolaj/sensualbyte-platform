import { getDocker, applyNginxRoute, deleteNginxRoute } from "@sensualbyte/provisioner";
import { setStatus } from "../common/status.js";

async function resolveTargetIp(obsCache, targetResourceId) {
    const obs = await obsCache.get(targetResourceId);
    return obs?.actual?.ip || obs?.actual?.lastKnown?.ip || null;
}

export async function reconcileHttpRoute({ resource, statusRepo, obsCache }) {
    const docker = getDocker();

    const hostname = resource.spec?.hostname;
    const targetResourceId = resource.spec?.targetResourceId;
    const targetPort = resource.spec?.targetPort;

    if (!hostname || !targetResourceId || !targetPort) {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "error",
            message: "Invalid http_route spec",
            details: { spec: resource.spec }
        });
        return { statusApplied: true };
    }

    if (resource.desiredState === "deleted") {
        await deleteNginxRoute({ docker, routeResourceId: resource.resourceId });

        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "ready",
            message: "Route deleted",
            details: { deleted: true }
        });

        await obsCache.set(resource.resourceId, {
            kind: "http_route",
            observedAt: new Date().toISOString(),
            actual: { deleted: true }
        });

        return { statusApplied: true };
    }

    const targetIp = await resolveTargetIp(obsCache, targetResourceId);
    if (!targetIp) {
        await setStatus(statusRepo, resource, {
            observedGeneration: resource.generation || 0,
            state: "creating",
            message: "Waiting for target IP",
            details: { targetResourceId }
        });
        return { statusApplied: true };
    }

    const applied = await applyNginxRoute({
        docker,
        routeResourceId: resource.resourceId,
        hostname,
        targetIp,
        targetPort
    });

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: "Route ready",
        details: { hostname, target: { ip: targetIp, port: targetPort }, applied }
    });

    await obsCache.set(resource.resourceId, {
        kind: "http_route",
        observedAt: new Date().toISOString(),
        actual: { hostname, targetIp, targetPort }
    });

    return { statusApplied: true };
}
