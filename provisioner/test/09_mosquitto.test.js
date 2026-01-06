import test from "node:test";
import assert from "node:assert/strict";

import { requireDocker } from "./helpers/docker.js";
import { mkResource } from "./helpers/ids.js";
import { ensureMosquitto } from "../src/adapters/mosquitto.js";

test("mosquitto: ensureMosquitto creates container (start optional)", async () => {
    const docker = await requireDocker();

    const resource = mkResource({
        kind: "mqtt",
        name: "test-mqtt",
        spec: {
            version: "2",
            network: { name: `sb_mqtt_net_${Date.now()}` },
            ports: { mqtt: 1883 }
        }
    });

    const c = await ensureMosquitto(docker, resource);
    assert.ok(c);

    // starting is optional in reconcile; but we can start to validate it can run
    await c.start();
    const i = await c.inspect();
    assert.equal(Boolean(i.State?.Running), true);

    // cleanup
    try { await c.stop({ t: 5 }); } catch (_) { }
    try { await c.remove({ force: true }); } catch (_) { }
});
