import { pingDocker } from "../../src/drivers/docker/client.js";

export async function waitForDocker({ timeoutMs = 15000, intervalMs = 500 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const res = await pingDocker();
        if (res.ok) return res;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Docker not reachable (timeout). Check DOCKER_SOCKET/DOCKER_HOST.");
}
