export function eventsOutboxRepo(db) {
    const col = db.collection("events_outbox");

    const workerId = process.env.WORKER_ID || "worker_1";
    const lockMs = Number(process.env.OUTBOX_LOCK_MS || 15000);
    const maxAttempts = Number(process.env.OUTBOX_MAX_ATTEMPTS || 10);

    function normalizeResult(res) {
        if (!res) return null;
        if (typeof res === "object" && "value" in res) return res.value || null;
        return res;
    }

    return {
        async claimNext() {
            const now = new Date();
            const lockExpiresAt = new Date(now.getTime() + lockMs);

            const res = await col.findOneAndUpdate(
                {
                    processed: false,
                    $or: [
                        { attempts: { $exists: false } },
                        { attempts: null },
                        { attempts: { $lt: maxAttempts } }
                    ],
                    $or: [
                        { lock: { $exists: false } },
                        { lock: null },
                        { "lock.lockExpiresAt": { $lte: now } }
                    ]
                },
                {
                    $set: {
                        lock: { lockedBy: workerId, lockedAt: now, lockExpiresAt },
                        updatedAt: now
                    },
                    $setOnInsert: { attempts: 0 }
                },
                {
                    sort: { createdAt: 1 },
                    returnDocument: "after",
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
                        // ✅ unlock immediately so next tick can retry
                        lock: null,
                        updatedAt: now
                    }
                }
            );
        }
    };
}
