import test from "node:test";
import assert from "node:assert/strict";
import { requireDocker, removeContainerIfExists, waitForContainerRunning } from "./helpers/docker.js";
import { ensureImage } from "../src/drivers/docker/images.js";
import { execInContainer } from "../src/drivers/docker/exec.js";

test("exec: execInContainer captures stdout/stderr/exitCode", async () => {
    const docker = await requireDocker();
    const image = "nginx:alpine";
    await ensureImage(docker, image);

    const name = `sb_test_exec_${Date.now()}`;
    await removeContainerIfExists(docker, name);

    // Create container that stays alive
    const c = await docker.createContainer({
        name,
        Image: image
    });

    await c.start();
    await waitForContainerRunning(docker, name);

    const r = await execInContainer(docker, name, ["sh", "-lc", "echo hello && echo errMsg 1>&2"]);
    assert.equal(r.exitCode, 0);
    assert.match(r.stdout, /hello/);
    assert.match(r.stderr, /errMsg/);

    await removeContainerIfExists(docker, name);
});
