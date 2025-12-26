const http = require("http");

function httpGetJson(host, port, path, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            { host, port, path, method: "GET", timeout: timeoutMs },
            (res) => {
                let data = "";
                res.on("data", (c) => (data += c));
                res.on("end", () => {
                    const ok = res.statusCode >= 200 && res.statusCode < 300;
                    resolve({ ok, statusCode: res.statusCode, body: data });
                });
            }
        );

        req.on("timeout", () => {
            req.destroy(new Error("health check timeout"));
        });
        req.on("error", reject);
        req.end();
    });
}

async function checkHealth(app) {
    const host = app.ip;
    const port = Number(app.internalPort || 3000);
    const path = (app.healthPath || "/health").startsWith("/")
        ? app.healthPath || "/health"
        : `/${app.healthPath}`;

    const startedAt = Date.now();
    try {
        const res = await httpGetJson(host, port, path, 2500);
        const ms = Date.now() - startedAt;

        if (!res.ok) {
            return {
                status: "unhealthy",
                latencyMs: ms,
                lastCheckedAt: new Date().toISOString(),
                lastError: `HTTP ${res.statusCode}`,
            };
        }

        return {
            status: "healthy",
            latencyMs: ms,
            lastCheckedAt: new Date().toISOString(),
            lastError: null,
        };
    } catch (e) {
        const ms = Date.now() - startedAt;
        return {
            status: "unhealthy",
            latencyMs: ms,
            lastCheckedAt: new Date().toISOString(),
            lastError: e.message || "unknown error",
        };
    }
}

module.exports = { checkHealth };
