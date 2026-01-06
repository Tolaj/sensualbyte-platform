export function resourceStatusRepo(db) {
    const col = db.collection("resource_status");

    return {
        async get(resourceId) {
            return col.findOne({ resourceId });
        },

        async upsert(resourceId, patch) {
            const p = patch || {};

            // Prevent Mongo conflict: never include resourceId inside $set
            const { resourceId: _ignore, ...safePatch } = p;

            // Always touch lastUpdatedAt unless caller already did
            if (!safePatch.lastUpdatedAt) safePatch.lastUpdatedAt = new Date();

            await col.updateOne(
                { resourceId },
                {
                    $setOnInsert: { resourceId },
                    $set: safePatch
                },
                { upsert: true }
            );

            return col.findOne({ resourceId });
        }
    };
}
