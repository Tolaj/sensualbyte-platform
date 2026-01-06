export function resourceStatusRepo(db) {
    const col = db.collection("resource_status");
    return {
        async get(resourceId) {
            return col.findOne({ resourceId });
        },
        async upsert(resourceId, patch) {
            const safe = { ...(patch || {}) };
            delete safe.resourceId;

            await col.updateOne(
                { resourceId },
                { $setOnInsert: { resourceId }, $set: safe },
                { upsert: true }
            );
            return col.findOne({ resourceId });
        }
    };
}
