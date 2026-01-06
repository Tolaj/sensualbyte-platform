export function resourceKindsRepo(db) {
    const col = db.collection("resource_kinds");

    return {
        async list() {
            return col.find({}).sort({ kind: 1 }).toArray();
        },
        async get(kind) {
            return col.findOne({ kind });
        }
    };
}
