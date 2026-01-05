import { MongoClient } from "mongodb";

let client = null;
let db = null;

export async function getMongoDb() {
    if (db) return db;

    const uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB;

    if (!uri) throw new Error("MONGO_URI is not set");
    if (!dbName) throw new Error("MONGO_DB is not set");

    console.log("▶ Connecting to MongoDB...");

    client = new MongoClient(uri, {
        ignoreUndefined: true,
        serverSelectionTimeoutMS: 3000, // ⬅️ CRITICAL
        connectTimeoutMS: 3000,
    });

    try {
        await client.connect();
    } catch (err) {
        console.error("❌ Mongo connect failed:", err.message);
        throw err;
    }

    db = client.db(dbName);
    console.log("✅ Mongo connected");

    return db;
}

export async function closeMongo() {
    if (client) await client.close();
    client = null;
    db = null;
}
