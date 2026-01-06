import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { requireDocker, removeContainerIfExists, waitForContainerRunning } from "./helpers/docker.js";
import { ensureImage } from "../src/drivers/docker/images.js";
import { applyNginxRoute, deleteNginxRoute } from "../src/gateway/http/nginx.js";

test("nginx gateway: apply/delete route (container managed by test)", async (t) => {
    const docker = await requireDocker();

    const confDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-nginx-conf-"));
    process.env.NGINX_CONF_DIR = confDir;

    const nginxName = `sb-nginx-test-${Date.now()}`;
    process.env.NGINX_CONTAINER_NAME = nginxName;

    await ensureImage(docker, "nginx:alpine");
    await removeContainerIfExists(docker, nginxName);

    const c = await docker.createContainer({
        name: nginxName,
        Image: "nginx:alpine",
        HostConfig: {
            Binds: [`${confDir}:/etc/nginx/conf.d`],
            PortBindings: { "80/tcp": [{ HostPort: "" }] }
        },
        ExposedPorts: { "80/tcp": {} }
    });

    await c.start();
    await waitForContainerRunning(docker, nginxName);

    const routeId = `route_${Date.now()}`;

    const applied = await applyNginxRoute({
        docker,
        routeResourceId: routeId,
        hostname: "test.local",
        targetIp: "127.0.0.1",
        targetPort: 80,
        pathPrefix: "/"
    });

    assert.ok(applied.file);
    const content = await fs.readFile(applied.file, "utf8");
    assert.match(content, /server_name test\.local/);

    const deleted = await deleteNginxRoute({ docker, routeResourceId: routeId });
    assert.equal(deleted.deleted, true);

    await removeContainerIfExists(docker, nginxName);
});
