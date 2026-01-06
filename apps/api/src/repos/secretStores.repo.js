export function secretStoresRepo(db) {
    const col = db.collection("secret_stores");

    return {
        async list() {
            return col.find({}).sort({ createdAt: -1 }).toArray();
        },
        async getByStoreId(storeId) {
            return col.findOne({ storeId });
        }
    };
}
