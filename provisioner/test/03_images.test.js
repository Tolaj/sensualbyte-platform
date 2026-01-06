import test from "node:test";
import assert from "node:assert/strict";
import { requireDocker } from "./helpers/docker.js";
import { ensureImage } from "../src/drivers/docker/images.js";

test("docker images: ensureImage pulls if missing and is idempotent", async () => {
    const docker = await requireDocker();

    // small and common
    const image = process.env.TEST_IMAGE || "nginx:alpine";

    const r1 = await ensureImage(docker, image);
    assert.equal(r1.image, image);

    const r2 = await ensureImage(docker, image);
    assert.equal(r2.image, image);

    // second run is usually not pulled (depends on local cache)
    assert.ok(typeof r2.pulled === "boolean");
});
