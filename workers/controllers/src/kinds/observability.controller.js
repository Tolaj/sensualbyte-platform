import { setStatus } from "../common/status.js";

export async function reconcileObservability({ resource, statusRepo, obsCache }) {
    await setStatus(statusRepo, resource.resourceId, {
        observedGeneration: resource.generation || 0,
        state: "ready",
        message: "Observability (v1 stub)",
        details: { note: "Logs/metrics pipeline comes next" }
    });

    await obsCache.set(resource.resourceId, {
        kind: "observability",
        observedAt: new Date().toISOString(),
        actual: { enabled: true }
    });

    return { statusApplied: true };
}
