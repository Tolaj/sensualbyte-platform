export function resourceStatusRepo(db) {
    const col = db.collection("resource_status");
    return {
        async get(resourceId) {
            return col.findOne({ resourceId });
        },

        async upsert(resourceId, patch) {
            // Prevent Mongo conflict: never include resourceId inside $set
            const { resourceId: _ignore, ...safePatch } = patch || {};

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
