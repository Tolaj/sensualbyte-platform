import test from "node:test";
import assert from "node:assert/strict";

import { requireDocker, removeContainerIfExists, waitForContainerRunning } from "./helpers/docker.js";
import { ensureImage } from "../src/drivers/docker/images.js";

async function getLogs(docker, name) {
    try {
        const c = docker.getContainer(name);
        const buf = await c.logs({ stdout: true, stderr: true, timestamps: false });
        return buf?.toString?.("utf8") || String(buf || "");
    } catch (_) {
        return "";
    }
}

async function runMcOnce(docker, { name, netName, configVol, cmdArgs }) {
    await removeContainerIfExists(docker, name);

    const c = await docker.createContainer({
        name,
        Image: "minio/mc:latest",
        Cmd: cmdArgs,
        HostConfig: {
            NetworkMode: netName,
            Binds: [`${configVol}:/root/.mc`]
        }
    });

    await c.start();
    const res = await c.wait();
    const logs = await getLogs(docker, name);

    try {
        await c.remove({ force: true });
    } catch (_) { }

    return { code: res.StatusCode, logs };
}

async function ensureNetwork(docker, netName) {
    const nets = await docker.listNetworks();
    const found = nets.find((n) => n.Name === netName);
    if (found) return docker.getNetwork(found.Id);
    return docker.createNetwork({ Name: netName, Driver: "bridge" });
}

async function ensureVolume(docker, volName) {
    try {
        const v = docker.getVolume(volName);
        await v.inspect();
        return v;
    } catch (_) {
        return docker.createVolume({ Name: volName });
    }
}

test(
    "minio: create bucket + delete bucket via mc inside docker network",
    { timeout: 60000 },
    async () => {
        const docker = await requireDocker();

        const netName = `sb_test_minio_net_${Date.now()}`;
        const minioName = `sb-minio-test-${Date.now()}`;
        const configVol = `sb_mc_cfg_${Date.now()}`;

        const mc1 = `sb-mc-alias-${Date.now()}`;
        const mc2 = `sb-mc-mb-${Date.now()}`;
        const mc3 = `sb-mc-rb-${Date.now()}`;

        await removeContainerIfExists(docker, minioName);
        await removeContainerIfExists(docker, mc1);
        await removeContainerIfExists(docker, mc2);
        await removeContainerIfExists(docker, mc3);

        const net = await ensureNetwork(docker, netName);
        await ensureVolume(docker, configVol);

        try {
            await ensureImage(docker, "minio/minio:latest");
            await ensureImage(docker, "minio/mc:latest");

            // MinIO on network (no host ports)
            const minio = await docker.createContainer({
                name: minioName,
                Image: "minio/minio:latest",
                Cmd: ["server", "/data", "--console-address", ":9001"],
                Env: ["MINIO_ROOT_USER=minioadmin", "MINIO_ROOT_PASSWORD=minioadmin"],
                HostConfig: { NetworkMode: netName }
            });

            await minio.start();
            await waitForContainerRunning(docker, minioName);

            const bucket = `sb-test-bucket-${Date.now()}`;

            // 1) alias set (retry a few times using multiple runs if needed)
            let ok = false;
            let aliasLogs = "";
            for (let i = 0; i < 20; i++) {
                const r = await runMcOnce(docker, {
                    name: mc1,
                    netName,
                    configVol,
                    cmdArgs: ["alias", "set", "local", `http://${minioName}:9000`, "minioadmin", "minioadmin"]
                });
                aliasLogs = r.logs;
                if (r.code === 0) {
                    ok = true;
                    break;
                }
                // small delay between retries
                await new Promise((res) => setTimeout(res, 500));
            }
            assert.equal(ok, true, `mc alias set never succeeded.\n--- last logs ---\n${aliasLogs}`);

            // 2) make bucket
            const mb = await runMcOnce(docker, {
                name: mc2,
                netName,
                configVol,
                cmdArgs: ["mb", `local/${bucket}`]
            });
            assert.equal(mb.code, 0, `mc mb failed.\n--- logs ---\n${mb.logs}`);

            // 3) remove bucket
            const rb = await runMcOnce(docker, {
                name: mc3,
                netName,
                configVol,
                cmdArgs: ["rb", "--force", `local/${bucket}`]
            });
            assert.equal(rb.code, 0, `mc rb failed.\n--- logs ---\n${rb.logs}`);
        } finally {
            // cleanup containers
            try {
                const c = docker.getContainer(minioName);
                try { await c.stop({ t: 2 }); } catch (_) { }
                try { await c.remove({ force: true }); } catch (_) { }
            } catch (_) { }

            // cleanup network + volume
            try { await net.remove(); } catch (_) { }
            try { await docker.getVolume(configVol).remove({ force: true }); } catch (_) { }
        }
    }
);
