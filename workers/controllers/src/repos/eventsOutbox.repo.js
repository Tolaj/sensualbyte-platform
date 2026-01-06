export function eventsOutboxRepo(db) {
    const col = db.collection("events_outbox");
    const workerId = process.env.WORKER_ID || "worker_1";
    const lockMs = Number(process.env.OUTBOX_LOCK_MS || 15000);

    function normalizeResult(res) {
        // supports both return shapes:
        // 1) ModifyResult { value: doc|null }
        // 2) doc|null
        if (!res) return null;
        if (typeof res === "object" && "value" in res) return res.value || null;
        return res; // doc (or null)
    }

    return {
        async claimNext() {
            const now = new Date();
            const lockExpiresAt = new Date(now.getTime() + lockMs);

            const res = await col.findOneAndUpdate(
                {
                    processed: false,
                    $or: [
                        { lock: { $exists: false } },
                        { lock: null },
                        { "lock.lockExpiresAt": { $lte: now } }
                    ]
                },
                { $set: { lock: { lockedBy: workerId, lockedAt: now, lockExpiresAt }, updatedAt: now } },
                {
                    sort: { createdAt: 1 },
                    returnDocument: "after",
                    // force ModifyResult shape on newer drivers (safe even if ignored)
                    includeResultMetadata: true
                }
            );

            return normalizeResult(res);
        },

        async markDone(eventId) {
            const now = new Date();
            await col.updateOne(
                { eventId },
                { $set: { processed: true, processedAt: now, lock: null, updatedAt: now } }
            );
        },

        async markFailed(eventId, err) {
            const now = new Date();
            await col.updateOne(
                { eventId },
                {
                    $inc: { attempts: 1 },
                    $set: {
                        lastError: String(err?.message || err),
                        // expire lock immediately so another tick can retry
                        "lock.lockExpiresAt": now,
                        updatedAt: now
                    }
                }
            );
        }
    };
}
