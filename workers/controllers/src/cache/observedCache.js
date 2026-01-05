function key(resourceId) {
    return `observed:resource:${resourceId}`;
}

export function observedCache(redis) {
    const ttl = Number(process.env.OBSERVED_TTL_SECONDS || 120);

    return {
        async set(resourceId, payload) {
            const value = JSON.stringify(payload);
            await redis.set(key(resourceId), value, { EX: ttl });
        },
        async get(resourceId) {
            const v = await redis.get(key(resourceId));
            return v ? JSON.parse(v) : null;
        }
    };
}
