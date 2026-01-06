import test from "node:test";
import assert from "node:assert/strict";
import { requireDocker, removeNetworkIfExistsByName } from "./helpers/docker.js";
import { ensureNetwork, removeNetworkIfExists } from "../src/drivers/docker/networks.js";

test("docker networks: ensureNetwork creates and is idempotent", async () => {
    const docker = await requireDocker();
    const netName = `sb_test_net_${Date.now()}`;

    await removeNetworkIfExistsByName(docker, netName);

    const n1 = await ensureNetwork(docker, netName, { "sensualbyte.test": "true" });
    assert.ok(n1);

    const n2 = await ensureNetwork(docker, netName, { "sensualbyte.test": "true" });
    assert.ok(n2);

    const rm = await removeNetworkIfExists(docker, netName);
    assert.equal(rm.removed, true);
});
