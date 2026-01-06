export function usersRepo(db) {
    const col = db.collection("users");

    return {
        async list({ limit = 50 } = {}) {
            return col.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
        },

        async getByUserId(userId) {
            return col.findOne({ userId });
        },

        async create(doc) {
            await col.insertOne(doc);
            return doc;
        },

        async updateByUserId(userId, patch) {
            await col.updateOne({ userId }, { $set: patch });
            return col.findOne({ userId });
        }
    };
}
