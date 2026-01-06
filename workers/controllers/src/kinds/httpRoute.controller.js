import { getDocker, applyNginxRoute, deleteNginxRoute } from "../../../../provisioner/src/index.js";
import { setStatus } from "../common/status.js";

async function resolveTargetIp(obsCache, targetResourceId) {
    const obs = await obsCache.get(targetResourceId);
    const ip = obs?.actual?.ip || obs?.actual?.lastKnown?.ip || null;
    return ip;
}

export async function reconcileHttpRoute({ resource, statusRepo, obsCache }) {
    const docker = getDocker();
    const hostname = resource.spec?.hostname;
    const targetResourceId = resource.spec?.targetResourceId;
    const targetPort = resource.spec?.targetPort;

    if (!hostname || !targetResourceId || !targetPort) {
        await setStatus(statusRepo, resource.resourceId, { observedGeneration: resource.generation || 0, state: "error", message: "Invalid http_route spec", details: { spec: resource.spec } });
        return;
    }

    if (resource.desiredState === "deleted") {
        await deleteNginxRoute({ docker, routeResourceId: resource.resourceId });
        await setStatus(statusRepo, resource.resourceId, { observedGeneration: resource.generation || 0, state: "ready", message: "Route deleted", details: { deleted: true } });
        await obsCache.set(resource.resourceId, { kind: "http_route", observedAt: new Date().toISOString(), actual: { deleted: true } });
        return;
    }

    const targetIp = await resolveTargetIp(obsCache, targetResourceId);
    if (!targetIp) {
        await setStatus(statusRepo, resource.resourceId, { state: "creating", message: "Waiting for target IP", details: { targetResourceId } });
        return;
    }

    const applied = await applyNginxRoute({ docker, routeResourceId: resource.resourceId, hostname, targetIp, targetPort });

    await setStatus(statusRepo, resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: "Route ready",
        details: { hostname, target: { ip: targetIp, port: targetPort }, applied }
    });

    await obsCache.set(resource.resourceId, { kind: "http_route", observedAt: new Date().toISOString(), actual: { hostname, targetIp, targetPort } });
}

