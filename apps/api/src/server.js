import "../../../packages/shared/loadEnv.js";
import http from "node:http";

import { createApp } from "./app.js";
import { getMongoDb, closeMongo } from "./db/mongo.js";
import { getRedis, closeRedis } from "./db/redis.js";

const PORT = Number(process.env.API_PORT || 3001);
const HOST = process.env.API_HOST || "0.0.0.0";

async function main() {
    const db = await getMongoDb();
    const redis = await getRedis();

    const app = createApp({ db, redis });

    app.get("/", (_req, res) => res.json({ status: "OK" }));

    const server = http.createServer(app);

    server.listen(PORT, HOST, () => {
        console.log(`✅ API listening on http://${HOST}:${PORT}`);
    });

    const shutdown = async (sig) => {
        console.log(`\n🛑 ${sig} received, shutting down...`);

        try {
            await new Promise((resolve) => server.close(resolve));
        } catch (e) {
            console.error("server close error:", e?.message || e);
        }

        try {
            await closeRedis();
        } catch (e) {
            console.error("redis close error:", e?.message || e);
        }

        try {
            await closeMongo();
        } catch (e) {
            console.error("mongo close error:", e?.message || e);
        }

        process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
    console.error("❌ Failed to start API:", err);
    process.exit(1);
});
