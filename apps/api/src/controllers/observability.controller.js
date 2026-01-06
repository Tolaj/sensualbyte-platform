function key(resourceId) {
    return `observed:resource:${resourceId}`;
}

async function scanKeys(redis, pattern, count = 200) {
    let cursor = "0";
    const out = [];
    do {
        const res = await redis.scan(cursor, { MATCH: pattern, COUNT: count });
        cursor = res.cursor;
        out.push(...res.keys);
    } while (cursor !== "0");
    return out;
}

export function observabilityController() {
    return {
        observed: async (req, res) => {
            const redis = req.ctx.redis;
            if (!redis) {
                const e = new Error("Redis not available on req.ctx.redis (check server/app wiring)");
                e.statusCode = 500;
                throw e;
            }

            const resourceId = String(req.params.resourceId);
            const v = await redis.get(key(resourceId));
            res.json({ observed: v ? JSON.parse(v) : null });
        },

        observedList: async (req, res) => {
            const redis = req.ctx.redis;
            if (!redis) {
                const e = new Error("Redis not available on req.ctx.redis (check server/app wiring)");
                e.statusCode = 500;
                throw e;
            }

            const keys = await scanKeys(redis, "observed:resource:*");
            const out = [];

            for (const k of keys) {
                const v = await redis.get(k);
                if (v) out.push({ key: k, value: JSON.parse(v) });
            }

            res.json({ observed: out });
        }
    };
}
