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
            await col.updateOne(
                {
                    resourceType: doc.resourceType,
                    resourceId: doc.resourceId,
                    subjectType: doc.subjectType,
                    subjectId: doc.subjectId
                },
                { $setOnInsert: doc },
                { upsert: true }
            );
            return doc;
        }
    };
}
