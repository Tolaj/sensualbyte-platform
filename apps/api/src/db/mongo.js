import { MongoClient } from "mongodb";

let client = null;
let db = null;

function num(name, fallback) {
    const v = Number(process.env[name]);
    return Number.isFinite(v) ? v : fallback;
}

function redactMongoUri(uri) {
    // mongodb://user:pass@host:port/db -> mongodb://***@host:port/db
    try {
        const u = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
        const auth = u.username || u.password ? "***@" : "";
        return `mongodb://${auth}${u.host}${u.pathname || ""}`;
    } catch {
        return "mongodb://***";
    }
}

export async function getMongoDb() {
    if (db) return db;

    const uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB;

    if (!uri) throw new Error("MONGO_URI is not set");
    if (!dbName) throw new Error("MONGO_DB is not set");

    const serverSelectionTimeoutMS = num("MONGO_SERVER_SELECTION_TIMEOUT_MS", 5000);
    const connectTimeoutMS = num("MONGO_CONNECT_TIMEOUT_MS", 5000);
    const maxPoolSize = num("MONGO_MAX_POOL_SIZE", 20);

    console.log("▶ Connecting to MongoDB...", {
        uri: redactMongoUri(uri),
        db: dbName,
        serverSelectionTimeoutMS,
        connectTimeoutMS,
        maxPoolSize
    });

    client = new MongoClient(uri, {
        ignoreUndefined: true,
        serverSelectionTimeoutMS,
        connectTimeoutMS,
        maxPoolSize
    });

    try {
        await client.connect();
        // real connectivity check (helps catch “connected but not usable” cases)
        await client.db("admin").command({ ping: 1 });
    } catch (err) {
        console.error("❌ Mongo connect failed:", err?.message || err);
        try { await client.close(); } catch { }
        client = null;
        db = null;
        throw err;
    }

    db = client.db(dbName);
    console.log("✅ Mongo connected");
    return db;
}

export async function closeMongo() {
    if (client) {
        try {
            await client.close();
        } finally {
            client = null;
            db = null;
        }
    } else {
        client = null;
        db = null;
    }
}
