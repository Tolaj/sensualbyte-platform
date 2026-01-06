export function teamMembersRepo(db) {
    const col = db.collection("team_members");

    return {
        async listByTeam(teamId) {
            return col.find({ teamId }).sort({ createdAt: -1 }).toArray();
        },

        async isMember(teamId, userId) {
            return Boolean(await col.findOne({ teamId, userId }));
        },

        async add(doc) {
            await col.insertOne(doc);
            return doc;
        },

        async remove(teamId, userId) {
            await col.deleteOne({ teamId, userId });
            return { removed: true };
        },

        async listTeamsForUser(userId) {
            const rows = await col.find({ userId }).toArray();
            return rows.map((r) => r.teamId);
        }
    };
}
