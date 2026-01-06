import test from "node:test";
import assert from "node:assert/strict";

import { requireDocker } from "./helpers/docker.js";
import { mkResource } from "./helpers/ids.js";
import { ensurePostgresContainer, startIfNeeded, removePostgresIfExists, extractObserved } from "../src/adapters/postgres.js";

test("postgres: ensure/start/remove + extractObserved", async () => {
    const docker = await requireDocker();

    const resource = mkResource({
        kind: "postgres",
        name: "test-postgres",
        spec: { version: "16", dbName: "app", username: "app" }
    });

    const volumeName = `sb_pgdata_${resource.resourceId}`;
    const password = "testpass123";

    const c = await ensurePostgresContainer(docker, resource, password, volumeName);
    assert.ok(c);

    const started = await startIfNeeded(c);
    assert.equal(Boolean(started.State?.Running), true);

    const obs = extractObserved(started);
    assert.ok(obs.containerId);
    assert.ok(obs.containerName);

    // cleanup container (volume cleanup can be separate)
    const rm = await removePostgresIfExists(docker, resource.resourceId);
    assert.ok(typeof rm.removed === "boolean");
});
