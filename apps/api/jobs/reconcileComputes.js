const path = require("path");
const { readJson, writeJson } = require("../lib/store");
const provisioner = require("../../../provisioner");
const config = require("../config");

const STORE = path.join(process.cwd(), "runtime", "computes.json");

function load() {
    return readJson(STORE, { computes: [] });
}

async function reconcileComputes() {
    const data = load();
    const computes = data.computes;

    const containers = await provisioner.core.listContainersByLabel(
        "sensualbyte.type=compute"
    );

    const dockerMap = new Map(
        containers.map(c => [c.Names[0].replace("/", ""), c])
    );

    for (const c of computes) {
        const name = c.containerName;
        const exists = dockerMap.has(name);

        if (c.status === "running" && !exists) {
            console.log("♻️ recreate compute", c.id);
            await provisioner.computes.create({
                computeId: c.id,
                cpu: c.cpu,
                memoryMb: c.memoryMb,
                network: config.DOCKER_NETWORK,
                image: "ubuntu:22.04",
                username: c.username
            });
            continue;
        }

        if (exists) {
            const info = await provisioner.core.inspectContainer(name);
            const running = info.State.Running;

            if (c.status === "running" && !running) {
                console.log("▶️ start compute", c.id);
                await provisioner.core.startContainer(name);
            }

            if (c.status === "stopped" && running) {
                console.log("⏹ stop compute", c.id);
                await provisioner.core.stopContainer(name);
            }
        }
    }
}

module.exports = { reconcileComputes };
