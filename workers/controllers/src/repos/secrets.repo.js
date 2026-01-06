export function secretsRepo(db) {
    const col = db.collection("secrets");
    return {
        async create(doc) {
            await col.insertOne(doc);
            return doc;
        },
        async get(secretId) {
            return col.findOne({ secretId });
        },
        async findByScope(scopeType, scopeId) {
            return col.find({ scopeType, scopeId }).toArray();
        }
    };
}
