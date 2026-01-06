export function catalogItemsRepo(db) {
    const col = db.collection("catalog_items");

    return {
        async list({ categoryId } = {}) {
            const q = {};
            if (categoryId) q.categoryId = categoryId;
            return col.find(q).sort({ createdAt: -1 }).toArray();
        },

        async getByCatalogId(catalogId) {
            return col.findOne({ catalogId });
        },

        async listByKind(kind) {
            return col.find({ kind }).sort({ createdAt: -1 }).toArray();
        }
    };
}
