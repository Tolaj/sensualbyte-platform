import "../../../../packages/shared/loadEnv.js";
import { getMongoDb, closeMongo } from "./mongo.js";
import { applyCollectionValidators } from "./validators.js";
import { ensureIndexes } from "./indexes.js";

async function main() {
    const db = await getMongoDb();

    await db.dropDatabase();

    await applyCollectionValidators(db);
    await ensureIndexes(db);
    await closeMongo();
    console.log("✅ Mongo validators + indexes applied");
}

main().catch(async (err) => {
    console.error("❌ db:setup failed:", err);
    await closeMongo();
    process.exit(1);
});
