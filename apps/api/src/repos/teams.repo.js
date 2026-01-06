export function teamsRepo(db) {
    const col = db.collection("teams");

    return {
        async list({ limit = 100 } = {}) {
            return col.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
        },

        async getByTeamId(teamId) {
            return col.findOne({ teamId });
        },

        async create(doc) {
            await col.insertOne(doc);
            return doc;
        }
    };
}
