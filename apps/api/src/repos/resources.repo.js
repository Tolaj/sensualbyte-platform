export function resourcesRepo(db) {
    const col = db.collection("resources");
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
            await col.updateOne({ resourceId }, { $set: patch });
            return col.findOne({ resourceId });
        }
    };
}
