export function resourceStatusRepo(db) {
    const col = db.collection("resource_status");
    return {
        async upsert(resourceId, patch) {
            // avoid the Mongo conflict by not setting resourceId in $set
            const { resourceId: _ignore, ...safe } = patch || {};
            await col.updateOne(
                { resourceId },
                { $setOnInsert: { resourceId }, $set: safe },
                { upsert: true }
            );
            return col.findOne({ resourceId });
        }
    };
}
