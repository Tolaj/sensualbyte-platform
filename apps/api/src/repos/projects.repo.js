export function projectsRepo(db) {
    const col = db.collection("projects");

    return {
        async listByTeam(teamId, { limit = 100 } = {}) {
            return col.find({ teamId }).sort({ createdAt: -1 }).limit(limit).toArray();
        },

        async getByProjectId(projectId) {
            return col.findOne({ projectId });
        },

        async create(doc) {
            await col.insertOne(doc);
            return doc;
        }
    };
}
