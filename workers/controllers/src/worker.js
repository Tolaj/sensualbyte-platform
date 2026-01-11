import "../../../packages/shared/loadEnv.js";
import { getMongoDb } from "./db/mongo.js";
import { getRedis } from "./db/redis.js";

import { eventsOutboxRepo } from "./repos/eventsOutbox.repo.js";
import { resourcesRepo } from "./repos/resources.repo.js";
import { resourceStatusRepo } from "./repos/resourceStatus.repo.js";
import { secretsRepo } from "./repos/secrets.repo.js";
import { observedCache } from "./cache/observedCache.js";
import { createOutboxPoller } from "./outboxPoller.js";
import { createDriftSweeper } from "./driftSweep.js";

const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 400);

async function main() {
    const db = await getMongoDb();
    const redis = await getRedis();

    const poller = createOutboxPoller({
        outboxRepo: eventsOutboxRepo(db),
        resourcesRepo: resourcesRepo(db),
        statusRepo: resourceStatusRepo(db),
        secretsRepo: secretsRepo(db),
        obsCache: observedCache(redis)
    });

    const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 400);
    const IDLE_SLEEP_MS = POLL_MS;
    const ERROR_BACKOFF_MS = 800;

    const obsCache = observedCache(redis);

    const sweeper = createDriftSweeper({
        db,
        statusRepo: resourceStatusRepo(db),
        obsCache,
        secretsRepo: secretsRepo(db),
        workerId: process.env.WORKER_ID
    });

    console.log("✅ worker running", { id: process.env.WORKER_ID || "worker_01" });

    while (true) {
        try {
            // 1) Outbox is highest priority
            const didOutboxWork = await poller.tick();

            // 2) If no outbox work, run drift sweep (converge actual -> desired)
            let didSweepWork = false;
            if (!didOutboxWork) {
                didSweepWork = await sweeper.runOnce(); // returns true if it reconciled anything
            }

            // 3) If nothing happened, sleep a bit
            if (!didOutboxWork && !didSweepWork) {
                await new Promise((r) => setTimeout(r, IDLE_SLEEP_MS));
            }
        } catch (e) {
            console.error("worker error:", {
                message: e?.message || String(e),
                code: e?.code,
                schemaRulesNotSatisfied: e?.errInfo?.details?.schemaRulesNotSatisfied,
            });

            // backoff to avoid log spam / hot loop
            await new Promise((r) => setTimeout(r, ERROR_BACKOFF_MS));
        }
    }

}

main().catch((e) => {
    console.error("❌ worker failed:", e);
    process.exit(1);
});
