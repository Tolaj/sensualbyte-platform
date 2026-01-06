import { getRedis } from "../db/redis.js";

export function observabilityController() {
    return {
        observed: async (req, res) => {
            const redis = await getRedis();
            const resourceId = req.params.resourceId;
            const v = await redis.get(`observed:resource:${resourceId}`);
            res.json({ observed: v ? JSON.parse(v) : null });
        },

        observedList: async (req, res) => {
            const redis = await getRedis();
            const keys = await redis.keys("observed:resource:*");
            const out = [];
            for (const k of keys) {
                const v = await redis.get(k);
                if (v) out.push({ key: k, value: JSON.parse(v) });
            }
            res.json({ observed: out });
        }
    };
}
