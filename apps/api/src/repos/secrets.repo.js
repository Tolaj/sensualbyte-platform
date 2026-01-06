export function secretsRepo(db) {
    const col = db.collection("secrets");
    return {
        get: (secretId) => col.findOne({ secretId }),
        listByScope: (scopeType, scopeId) => col.find({ scopeType, scopeId }).sort({ createdAt: -1 }).toArray()
    };
}
