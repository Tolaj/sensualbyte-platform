import test from "node:test";
import assert from "node:assert/strict";

import { getMongoDb, closeMongo } from "../src/db/mongo.js";
import { getRedis, closeRedis } from "../src/db/redis.js";

import { eventsOutboxRepo } from "../src/repos/eventsOutbox.repo.js";
import { resourcesRepo } from "../src/repos/resources.repo.js";
import { resourceStatusRepo } from "../src/repos/resourceStatus.repo.js";
import { secretsRepo } from "../src/repos/secrets.repo.js";
import { observedCache } from "../src/cache/observedCache.js";
import { createOutboxPoller } from "../src/outboxPoller.js";

import { getDocker, removeComputeIfExists } from "@sensualbyte/provisioner";
import { startMongo, startRedis, stopAndRemove } from "./helpers/docker.js";

test("worker e2e: compute resource -> provisions docker container and sets status/observed", { timeout: 120000 }, async () => {
    // Start infra
    const mongo = await startMongo();
    const redisC = await startRedis();

    // Configure env for worker db clients
    process.env.MONGO_URI = `mongodb://127.0.0.1:${mongo.hostPort}`;
    process.env.MONGO_DB = "sb_worker_test";
    process.env.REDIS_URL = `redis://127.0.0.1:${redisC.hostPort}`;

    // Required by provisioner crypto (if any controller hits encrypt/decrypt)
    process.env.MASTER_KEY_HEX = process.env.MASTER_KEY_HEX || "a".repeat(64);

    // Keep cache short for tests
    process.env.OBSERVED_TTL_SECONDS = "60";
    process.env.WORKER_ID = "worker_test_1";

    const db = await getMongoDb();
    const redis = await getRedis();

    const outbox = eventsOutboxRepo(db);
    const resources = resourcesRepo(db);
    const status = resourceStatusRepo(db);
    const secrets = secretsRepo(db);
    const obs = observedCache(redis);

    // Seed resource + event
    const resourceId = `res_compute_test_${Date.now()}`;
    const projectId = "proj_demo";

    await db.collection("resources").insertOne({
        resourceId,
        projectId,
        kind: "compute",
        name: "hello-web",
        generation: 1,
        spec: {
            implementation: "docker",
            image: "nginxdemos/hello:latest",
            mode: "paas",
            resources: { cpu: 0.2, memoryMb: 128 },
            network: { name: "sensual_test_net", exposure: "public", internalPort: 80 },
            env: {}
        },
        desiredState: "running",
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await db.collection("events_outbox").insertOne({
        eventId: `evt_${Date.now()}`,
        type: "RESOURCE_CHANGED",
        resourceType: "resource",
        resourceId,
        processed: false,
        attempts: 0,
        createdAt: new Date()
    });

    const poller = createOutboxPoller({
        outboxRepo: outbox,
        resourcesRepo: resources,
        statusRepo: status,
        secretsRepo: secrets,
        obsCache: obs
    });

    // Run one reconcile
    const didWork = await poller.tick();
    assert.equal(didWork, true);

    // Verify status
    const st = await db.collection("resource_status").findOne({ resourceId });
    assert.ok(st, "resource_status should exist");
    assert.equal(st.state, "ready");

    // Verify observed cache
    const cached = await obs.get(resourceId);
    assert.ok(cached, "observed cache should exist");
    assert.equal(cached.kind, "compute");
    assert.ok(cached.actual);

    // Verify docker container exists
    const docker = getDocker();
    const name = `sb_compute_${resourceId}`;
    const inspect = await docker.getContainer(name).inspect();
    assert.equal(inspect.Name.replace(/^\//, ""), name);

    // Cleanup docker compute
    await removeComputeIfExists(docker, resourceId);

    // Cleanup db/cache + containers
    await closeRedis();
    await closeMongo();
    await stopAndRemove(redisC.container);
    await stopAndRemove(mongo.container);
});
