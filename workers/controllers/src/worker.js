import "dotenv/config";
import { getMongoDb } from "./db/mongo.js";
import { getRedis } from "./db/redis.js";

import { eventsOutboxRepo } from "./repos/eventsOutbox.repo.js";
import { resourcesRepo } from "./repos/resources.repo.js";
import { resourceStatusRepo } from "./repos/resourceStatus.repo.js";
import { observedCache } from "./cache/observedCache.js";
import { createOutboxPoller } from "./outboxPoller.js";

const INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 500);

async function main() {
    const db = await getMongoDb();
    const redis = await getRedis();

    const outbox = eventsOutboxRepo(db);
    const resources = resourcesRepo(db);
    const status = resourceStatusRepo(db);
    const obs = observedCache(redis);

    const poller = createOutboxPoller({
        outboxRepo: outbox,
        resourcesRepo: resources,
        statusRepo: status,
        obsCache: obs
    });

    console.log("✅ Controllers worker started");

    // Simple loop: keep draining outbox
    while (true) {
        try {
            const didWork = await poller.tick();
            if (!didWork) {
                await new Promise((r) => setTimeout(r, INTERVAL_MS));
            }
        } catch (err) {
            console.error("Worker error:", err);
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
}

main().catch((err) => {
    console.error("❌ Worker failed to start:", err);
    process.exit(1);
});
