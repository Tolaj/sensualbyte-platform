export function resourcesRepo(db) {
    const col = db.collection("resources");
    return {
        async getByResourceId(resourceId) {
            return col.findOne({ resourceId });
        }
    };
}
