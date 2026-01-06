import { getDocker, pingDocker } from "../../src/drivers/docker/client.js";

export async function requireDocker() {
    const res = await pingDocker();
    if (!res.ok) {
        throw new Error(`Docker not reachable: ${res.error}\nHint: ${res.hint}`);
    }
    return getDocker();
}

export async function removeContainerIfExists(docker, name) {
    try {
        const c = docker.getContainer(name);
        const i = await c.inspect();
        if (i?.State?.Running) {
            try { await c.stop({ t: 5 }); } catch (_) { }
        }
        await c.remove({ force: true });
        return true;
    } catch (_) {
        return false;
    }
}

export async function removeNetworkIfExistsByName(docker, netName) {
    const nets = await docker.listNetworks();
    const found = nets.find(n => n.Name === netName);
    if (!found) return false;
    try {
        await docker.getNetwork(found.Id).remove();
        return true;
    } catch (_) {
        return false;
    }
}

export async function removeVolumeIfExistsByName(docker, volName) {
    try {
        const v = docker.getVolume(volName);
        await v.remove({ force: true });
        return true;
    } catch (_) {
        return false;
    }
}

export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export async function waitForContainerRunning(docker, name, { timeoutMs = 15000 } = {}) {
    const start = Date.now();
    const c = docker.getContainer(name);
    while (Date.now() - start < timeoutMs) {
        try {
            const i = await c.inspect();
            if (i?.State?.Running) return i;
        } catch (_) { }
        await sleep(300);
    }
    throw new Error(`Container did not reach running state: ${name}`);
}
