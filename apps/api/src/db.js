const { MongoClient } = require("mongodb");
const { MONGO_URI, MONGO_DB } = require("./config");

const client = new MongoClient(MONGO_URI);
let db;

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db(MONGO_DB);
        console.log("✅ Mongo connected:", MONGO_DB);
    }
    return db;
}

module.exports = { connectDB };
