import crypto from "node:crypto";
import { setStatus } from "./status.js";
import { ensureFinalizers } from "./finalizers.js";

function now() { return new Date(); }

function buildCtx(input) {
    return {
        ...input,
        requestId: input.requestId || crypto.randomUUID(),
        startedAt: now()
    };
}

export async function reconcileWrapper(fn, inputCtx) {
    const ctx = buildCtx(inputCtx);
    const { resource, statusRepo } = ctx;

    if (!resource?.resourceId) throw new Error("reconcileWrapper: resource.resourceId missing");

    try {
        await ensureFinalizers(resource);

        await setStatus(statusRepo, resource, {
            state: "creating", // must match schema enum
            message: "Reconciling resource",
            observedGeneration: resource.generation ?? 0
        });

        // controllers are responsible for setting final ready/error
        return await fn(ctx);
    } catch (err) {
        const msg = String(err?.message || err);

        try {
            await setStatus(statusRepo, resource, {
                state: "error",
                message: msg,
                observedGeneration: resource.generation ?? 0
            });
        } catch (e2) {
            console.error("failed to set error status:", e2?.message || e2);
        }

        throw err;
    }
}

