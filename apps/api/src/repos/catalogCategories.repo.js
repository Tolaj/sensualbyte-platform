export function catalogCategoriesRepo(db) {
    const col = db.collection("catalog_categories");

    return {
        async list() {
            return col.find({}).sort({ order: 1, createdAt: 1 }).toArray();
        }
    };
}
