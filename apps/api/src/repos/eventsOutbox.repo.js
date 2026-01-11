export function eventsOutboxRepo(db) {
    const col = db.collection("events_outbox");

    return {
        async enqueue(doc) {
            try {
                await col.insertOne(doc);
                return { inserted: true, doc };
            } catch (err) {
                if (err?.code === 11000) return { inserted: false, doc }; // duplicate key => safe
                throw err;
            }
        }
    };
}
