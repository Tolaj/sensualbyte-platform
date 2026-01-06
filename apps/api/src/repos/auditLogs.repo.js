export function auditLogsRepo(db) {
    const col = db.collection("audit_logs");

    return {
        async write(entry) {
            await col.insertOne(entry);
            return entry;
        },

        async list({ limit = 100 } = {}) {
            return col.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
        },

        async insert(doc) {
            await col.insertOne(doc);
            return doc;
        }
    };
}
