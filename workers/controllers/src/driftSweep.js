import { dispatch } from "./dispatcher.js";
import { reconcileWrapper } from "./common/reconcile.js";

function bool(v, fallback = false) {
    const s = String(v ?? "").toLowerCase();
    if (!s) return fallback;
    return s === "true" || s === "1" || s === "yes";
}

function normalizeDesiredState(ds) {
    // Back-compat: older API used "active"
    if (!ds) return "running";
    const v = String(ds).toLowerCase();
    if (v === "active") return "running";
    return v;
}

/**
 * desired vs observed check (cheap).
 * If we can prove it matches, we skip.
 * If we can't prove (missing fields / missing cache), we reconcile.
 */
function desiredMatchesObserved(resource, obs) {
    const desired = normalizeDesiredState(resource.desiredState);

    // If no observed cache -> we don't know -> reconcile to refresh observed
    if (!obs || !obs.actual) return false;

    // Deleted desired: observed should mark deleted
    if (desired === "deleted") {
        return obs.actual.deleted === true || obs.actual.state === "deleted";
    }

    // compute/postgres: check running flag if present
    if (resource.kind === "compute" || resource.kind === "postgres") {
        if (typeof obs.actual.running !== "boolean") return false;
        if (desired === "paused") return obs.actual.running === false;
        // running/active/default
        return obs.actual.running === true;
    }

    // volume/bucket/http_route/observability: just require presence (and not deleted)
    if (obs.actual.deleted === true) return false;

    // http_route: validate the hostname/port we can see in cache
    if (resource.kind === "http_route") {
        const wantHost = resource.spec?.hostname ?? null;
        const wantPort = resource.spec?.targetPort ?? null;
        const gotHost = obs.actual.hostname ?? null;
        const gotPort = obs.actual.targetPort ?? null;
        if (!wantHost || !wantPort) return false;
        return wantHost === gotHost && Number(wantPort) === Number(gotPort);
    }

    return true;
}

export function createDriftSweeper({ db, statusRepo, obsCache, secretsRepo, workerId }) {
    const enabled = bool(process.env.WORKER_DRIFT_SWEEP_ENABLED, true);
    const intervalMs = Number(process.env.WORKER_DRIFT_SWEEP_INTERVAL_MS || 5000);
    const limit = Number(process.env.WORKER_DRIFT_SWEEP_LIMIT || 50);

    let running = false;

    async function runOnce() {
        if (!enabled) return false;
        if (running) return false;
        running = true;

        try {
            // Only sweep “live” resources
            const resources = await db
                .collection("resources")
                .find({ desiredState: { $ne: "deleted" } })
                .sort({ updatedAt: -1 })
                .limit(limit)
                .toArray();

            let reconciled = 0;

            for (const resource of resources) {
                const obs = await obsCache.get(resource.resourceId);

                // Step 1: desired vs observed
                if (desiredMatchesObserved(resource, obs)) continue;

                // Step 2/3: observed differs (or missing) => check actual + enforce desired via reconcile
                await reconcileWrapper(dispatch, {
                    resource,
                    statusRepo,
                    obsCache,
                    secretsRepo,
                    requestId: `drift:${workerId}:${resource.resourceId}`
                });

                reconciled++;
            }

            return reconciled > 0;
        } finally {
            running = false;
        }
    }

    function start() {
        if (!enabled) return { stop() { }, intervalMs };

        const t = setInterval(() => {
            runOnce().catch((e) => {
                console.error("drift sweep error:", e?.message || e);
            });
        }, intervalMs);

        return {
            stop() { clearInterval(t); },
            intervalMs
        };
    }

    return { start, runOnce, intervalMs, enabled };
}
