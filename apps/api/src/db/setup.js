import { loadEnv } from "../config/loadEnv.js";
import { getMongoDb, closeMongo } from "./mongo.js";
import { applyCollectionValidators } from "./validators.js";
import { ensureIndexes } from "./indexes.js";

function bool(v) {
  return String(v || "").toLowerCase() === "true";
}

async function main() {
  loadEnv();
  const db = await getMongoDb();

  if (bool(process.env.DB_RESET)) {
    console.warn("⚠️ DB_RESET=true -> dropping database:", process.env.MONGO_DB);
    await db.dropDatabase();
  }

  console.log("▶ Applying collection validators...");
  await applyCollectionValidators(db);

  console.log("▶ Ensuring indexes...");
  await ensureIndexes(db);

  console.log("✅ Mongo validators + indexes applied");
}

main()
  .catch((err) => {
    console.error("❌ db:setup failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongo();
  });
