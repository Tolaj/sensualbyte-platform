import test from "node:test";
import assert from "node:assert/strict";
import { pingDocker } from "../src/drivers/docker/client.js";

test("docker: pingDocker() returns ok", async () => {
    const res = await pingDocker();
    assert.equal(typeof res.ok, "boolean");
    assert.equal(res.ok, true, `Docker not reachable: ${res.error} (${res.hint || ""})`);
});
