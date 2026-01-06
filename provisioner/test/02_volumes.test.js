import test from "node:test";
import assert from "node:assert/strict";
import { requireDocker } from "./helpers/docker.js";
import { ensureVolume, removeVolumeIfExists } from "../src/drivers/docker/volumes.js";

test("docker volumes: ensureVolume creates and is idempotent; removeVolumeIfExists removes", async () => {
    const docker = await requireDocker();
    const volName = `sb_test_vol_${Date.now()}`;

    await removeVolumeIfExists(docker, volName).catch(() => { });

    const v1 = await ensureVolume(docker, volName, { "sensualbyte.test": "true" });
    assert.ok(v1);

    const v2 = await ensureVolume(docker, volName, { "sensualbyte.test": "true" });
    assert.ok(v2);

    const rm = await removeVolumeIfExists(docker, volName);
    assert.equal(rm.removed, true);
});
