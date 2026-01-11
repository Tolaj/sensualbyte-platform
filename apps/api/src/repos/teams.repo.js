// apps/api/src/repos/teams.repo.js
export function teamsRepo(db) {
    const col = db.collection("teams");

    function httpError(statusCode, message, details = null) {
        const e = new Error(message);
        e.statusCode = statusCode;
        if (details) e.details = details;
        return e;
    }

    function normStr(v, field) {
        const s = String(v ?? "").trim();
        if (!s) throw httpError(400, `${field} is required`);
        return s;
    }

    function clampInt(v, { min = 1, max = 500, fallback = 100 } = {}) {
        const n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, Math.trunc(n)));
    }

    return {
        async list({ limit = 100 } = {}) {
            const lim = clampInt(limit, { min: 1, max: 500, fallback: 100 });
            return col.find({}).sort({ createdAt: -1 }).limit(lim).toArray();
        },

        async getByTeamId(teamId) {
            const id = normStr(teamId, "teamId");
            return col.findOne({ teamId: id });
        },

        async create(doc) {
            if (!doc || typeof doc !== "object") throw httpError(400, "doc must be an object");

            // Validate required fields for your current team schema usage
            const teamId = normStr(doc.teamId, "teamId");
            const name = normStr(doc.name, "name");
            const createdBy = normStr(doc.createdBy, "createdBy");
            const createdAt = doc.createdAt instanceof Date ? doc.createdAt : new Date();

            const toInsert = {
                ...doc,
                teamId,
                name,
                createdBy,
                createdAt
            };

            await col.insertOne(toInsert);
            return toInsert;
        }
    };
}
