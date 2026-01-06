import test from "node:test";
import assert from "node:assert/strict";
import { requireDocker, removeNetworkIfExistsByName } from "./helpers/docker.js";
import { mkResource } from "./helpers/ids.js";
import { ensureNetwork } from "../src/drivers/docker/networks.js";
import { ensureCompute, startIfNeeded, stopIfNeeded, removeComputeIfExists, extractObserved } from "../src/drivers/docker/compute.js";

test("compute: ensureCompute create/start/stop/remove + extractObserved", async () => {
    const docker = await requireDocker();
    const netName = `sb_test_net_compute_${Date.now()}`;

    await removeNetworkIfExistsByName(docker, netName);
    await ensureNetwork(docker, netName, { "sensualbyte.test": "true" });

    const resource = mkResource({
        kind: "compute",
        name: "test-compute",
        spec: {
            implementation: "docker",
            mode: "paas",
            image: process.env.TEST_COMPUTE_IMAGE || "nginx:alpine",
            network: { name: netName, exposure: "public", internalPort: 80 },
            resources: { cpu: 0.2, memoryMb: 128 },
            env: { HELLO: "world" }
        }
    });

    // create (idempotent)
    const c1 = await ensureCompute(docker, resource);
    assert.ok(c1);

    const c2 = await ensureCompute(docker, resource);
    assert.ok(c2);

    // start
    const started = await startIfNeeded(c1);
    assert.equal(Boolean(started.State?.Running), true);

    const obs = extractObserved(started);
    assert.ok(obs.containerId);
    assert.ok(obs.containerName);
    // ip may exist once on a network
    assert.ok(typeof obs.ip === "string" || obs.ip === null);

    // stop
    const stopped = await stopIfNeeded(c1);
    assert.equal(Boolean(stopped.State?.Running), false);

    // cleanup
    const rm = await removeComputeIfExists(docker, resource.resourceId);
    assert.equal(typeof rm.removed, "boolean");
});
