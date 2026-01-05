export function eventsOutboxRepo(db) {
    const col = db.collection("events_outbox");

    return {
        // Atomically claim one event (safe with multiple workers)
        async claimNext() {
            const res = await col.findOneAndUpdate(
                { processed: false },
                { $set: { processed: true, processedAt: new Date() } },
                { sort: { createdAt: 1 }, returnDocument: "after" }
            );
            return res.value; // null if none
        }
    };
}
