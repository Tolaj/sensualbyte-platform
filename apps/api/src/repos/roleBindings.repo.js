export function roleBindingsRepo(db) {
    const col = db.collection("role_bindings");

    return {
        async listForResource(resourceType, resourceId) {
            return col.find({ resourceType, resourceId }).sort({ createdAt: -1 }).toArray();
        },

        async listForSubject(subjectType, subjectId) {
            return col.find({ subjectType, subjectId }).sort({ createdAt: -1 }).toArray();
        },

        async upsert(doc) {
            const filter = {
                resourceType: doc.resourceType,
                resourceId: doc.resourceId,
                subjectType: doc.subjectType,
                subjectId: doc.subjectId
            };

            await col.updateOne(
                filter,
                { $setOnInsert: { createdAt: doc.createdAt || new Date() }, $set: { role: doc.role } },
                { upsert: true }
            );

            return col.findOne(filter);
        }
    };
}
