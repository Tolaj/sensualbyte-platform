import { MongoClient } from "mongodb";

let client = null;
let db = null;

export async function getMongoDb() {
    if (db) return db;

    const uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB;
    if (!uri) throw new Error("MONGO_URI is not set");
    if (!dbName) throw new Error("MONGO_DB is not set");

    client = new MongoClient(uri, { ignoreUndefined: true });
    await client.connect();
    db = client.db(dbName);
    return db;
}

export async function closeMongo() {
    if (client) await client.close();
    client = null;
    db = null;
}
