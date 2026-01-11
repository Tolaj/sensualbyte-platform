// apps/api/src/repos/resourceStatus.repo.js
export function resourceStatusRepo(db) {
    const col = db.collection("resource_status");

    function normalizeId(resourceId) {
        const rid = String(resourceId ?? "").trim();
        if (!rid) {
            const e = new Error("resourceId is required");
            e.statusCode = 400;
            throw e;
        }
        return rid;
    }

    function stripImmutable(patch) {
        const safe = { ...(patch || {}) };
        delete safe.resourceId;   // immutable
        delete safe.createdAt;    // immutable if present
        return safe;
    }

    return {
        async get(resourceId) {
            const rid = normalizeId(resourceId);
            return col.findOne({ resourceId: rid });
        },

        async upsert(resourceId, patch) {
            const rid = normalizeId(resourceId);

            const safePatch = stripImmutable(patch);

            // Always touch lastUpdatedAt server-side (caller can’t prevent it)
            safePatch.lastUpdatedAt = new Date();

            const r = await col.findOneAndUpdate(
                { resourceId: rid },
                {
                    $setOnInsert: { resourceId: rid, createdAt: new Date() },
                    $set: safePatch
                },
                { upsert: true, returnDocument: "after" }
            );

            return r.value;
        }
    };
}
