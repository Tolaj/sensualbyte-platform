// apps/api/src/repos/resources.repo.js
export function resourcesRepo(db) {
    const col = db.collection("resources");

    function stripImmutable(patch) {
        const safe = { ...(patch || {}) };

        // Immutable (never mutable once created)
        delete safe.resourceId;
        delete safe.projectId;
        delete safe.kind;
        delete safe.createdAt;
        delete safe.createdBy;
        delete safe.parentResourceId;
        delete safe.rootResourceId;

        // IMPORTANT:
        // updatedAt MUST be allowed because the service sets it intentionally.
        // (Do not accept updatedAt from untrusted inputs in controllers; that is enforced elsewhere.)

        return safe;
    }

    function asNonEmptyString(v, fieldName) {
        const s = String(v ?? "").trim();
        if (!s) {
            const e = new Error(`${fieldName} is required`);
            e.statusCode = 400;
            throw e;
        }
        return s;
    }

    return {
        async getByResourceId(resourceId) {
            const rid = asNonEmptyString(resourceId, "resourceId");
            return col.findOne({ resourceId: rid });
        },

        async list({ projectId, kind } = {}) {
            const q = {};
            if (projectId) q.projectId = String(projectId);
            if (kind) q.kind = String(kind);

            return col.find(q).sort({ createdAt: -1 }).toArray();
        },

        async insert(doc) {
            await col.insertOne(doc);
            return doc;
        },

        async update(resourceId, patch) {
            const rid = asNonEmptyString(resourceId, "resourceId");
            const safe = stripImmutable(patch);

            const r = await col.findOneAndUpdate(
                { resourceId: rid },
                { $set: safe },
                { returnDocument: "after" }
            );

            return r.value; // null if not found
        },

        async deleteOneByResourceId(resourceId) {
            const rid = asNonEmptyString(resourceId, "resourceId");
            const r = await col.deleteOne({ resourceId: rid });
            return { deleted: r.deletedCount === 1 };
        }
    };
}
