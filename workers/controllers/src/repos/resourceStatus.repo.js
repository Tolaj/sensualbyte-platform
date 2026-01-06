export function resourceStatusRepo(db) {
    const col = db.collection("resource_status");
    return {
        async upsert(resourceId, patch) {
            const safe = { ...(patch || {}) };
            delete safe.resourceId; // critical (prevents conflict)

            await col.updateOne(
                { resourceId },
                { $setOnInsert: { resourceId }, $set: safe },
                { upsert: true }
            );
            return col.findOne({ resourceId });
        }
    };
}
