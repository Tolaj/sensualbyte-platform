import http from "node:http";
import { createApp } from "../../src/app.js";
import { getMongoDb, closeMongo } from "../../src/db/mongo.js";
import { getRedis, closeRedis } from "../../src/db/redis.js";

export async function startApiForTest() {
    const db = await getMongoDb();
    const redis = await getRedis();

    const app = createApp({ db, redis });

    // root route for sanity (your server.js adds this too; tests can add it here)
    app.get("/", (_req, res) => res.json({ status: "OK" }));

    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : null;

    if (!port) throw new Error("Failed to bind test server port");

    const baseUrl = `http://127.0.0.1:${port}`;

    async function stop() {
        await new Promise((resolve) => server.close(resolve));
        await closeRedis().catch(() => { });
        await closeMongo().catch(() => { });
    }

    return { baseUrl, db, redis, stop };
}
