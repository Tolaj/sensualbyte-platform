import net from "node:net";

export async function waitPort(host, port, { timeoutMs = 20000, intervalMs = 200 } = {}) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const ok = await new Promise((resolve) => {
            const s = net.createConnection({ host, port });
            s.on("connect", () => { s.destroy(); resolve(true); });
            s.on("error", () => resolve(false));
            s.setTimeout(800, () => { s.destroy(); resolve(false); });
        });

        if (ok) return true;
        await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`waitPort timeout: ${host}:${port}`);
}
