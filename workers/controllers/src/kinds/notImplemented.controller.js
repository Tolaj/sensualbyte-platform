import { setStatus } from "../common/status.js";

export async function reconcileNotImplemented({ resource, statusRepo }, opts = {}) {
    const reason = opts.reason || `Kind not implemented yet: ${resource.kind}`;

    await setStatus(statusRepo, resource, {
        observedGeneration: resource.generation || 0,
        state: "error",
        message: reason,
        details: { kind: resource.kind }
    });

    return { statusApplied: true };
}
