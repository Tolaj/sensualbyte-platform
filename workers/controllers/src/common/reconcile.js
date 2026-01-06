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

    // basic guard
    if (!resource?.resourceId) {
        throw new Error("reconcileWrapper: resource.resourceId missing");
    }

    try {
        // v1: finalizers placeholder; still call so delete flow can be added without refactor
        await ensureFinalizers(resource);

        // mark "creating" for new/updated resources if caller wants;
        // controllers will set ready/error with real details
        await setStatus(statusRepo, resource.resourceId, {
            state: "reconciling",
            message: "Reconciling resource",
            observedGeneration: resource.generation ?? 0
        });

        const result = await fn(ctx);

        // If controller didn’t set state explicitly, default to ready
        if (result?.statusApplied !== true) {
            await setStatus(statusRepo, resource.resourceId, {
                state: "ready",
                message: "Reconciled",
                observedGeneration: resource.generation ?? 0
            });
        }

        return result;
    } catch (err) {
        const msg = String(err?.message || err);

        // write error status so UI can show it
        try {
            await setStatus(statusRepo, resource.resourceId, {
                state: "error",
                message: msg,
                observedGeneration: resource.generation ?? 0
            });
        } catch (e2) {
            console.error("failed to set error status:", e2?.message || e2);
        }

        // rethrow so outboxPoller can markFailed
        throw err;
    }
}
