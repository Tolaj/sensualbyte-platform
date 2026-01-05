import "dotenv/config";
import { createApp } from "./app.js";
import { getMongoDb } from "./db/mongo.js";

const PORT = process.env.PORT || 3001;

async function main() {
    const db = await getMongoDb();
    const app = createApp({ db });


    app.get("/", (req, res) => {
        res.json({ status: "OK" });
    });

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ API listening on http://localhost:${PORT}`);
    });
}

main().catch((err) => {
    console.error("❌ Failed to start API:", err);
    process.exit(1);
});
