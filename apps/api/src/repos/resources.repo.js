export function resourcesRepo(db) {
    const col = db.collection("resources");

    function stripResourceId(patch) {
        const safe = { ...(patch || {}) };
        // never allow these to be updated
        delete safe.projectId;
        delete safe.createdAt;
        delete safe.createdBy;
        delete safe.resourceId; // prevent conflict & immutability break
        return safe;
    }


    return {
        async getByResourceId(resourceId) {
            return col.findOne({ resourceId });
        },

        async list({ projectId, kind } = {}) {
            const q = {};
            if (projectId) q.projectId = projectId;
            if (kind) q.kind = kind;

            return col.find(q).sort({ createdAt: -1 }).toArray();
        },

        async insert(doc) {
            await col.insertOne(doc);
            return doc;
        },

        async update(resourceId, patch) {
            const safe = stripResourceId(patch);
            await col.updateOne({ resourceId }, { $set: safe });
            return col.findOne({ resourceId });
        },

        async deleteOneByResourceId(resourceId) {
            const r = await col.deleteOne({ resourceId });
            return { deleted: r.deletedCount === 1 };
        }
    };
}
