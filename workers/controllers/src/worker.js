import "../../../packages/shared/loadEnv.js";
import { getMongoDb } from "./db/mongo.js";
import { getRedis } from "./db/redis.js";

import { eventsOutboxRepo } from "./repos/eventsOutbox.repo.js";
import { resourcesRepo } from "./repos/resources.repo.js";
import { resourceStatusRepo } from "./repos/resourceStatus.repo.js";
import { secretsRepo } from "./repos/secrets.repo.js";
import { observedCache } from "./cache/observedCache.js";
import { createOutboxPoller } from "./outboxPoller.js";

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

    console.log("✅ worker running", { id: process.env.WORKER_ID || "worker_1" });

    while (true) {
        try {
            const didWork = await poller.tick();
            if (!didWork) await new Promise((r) => setTimeout(r, POLL_MS));
        } catch (e) {
            console.error("worker error:", e?.message || e);
            await new Promise((r) => setTimeout(r, 800));
        }
    }
}

main().catch((e) => {
    console.error("❌ worker failed:", e);
    process.exit(1);
});
