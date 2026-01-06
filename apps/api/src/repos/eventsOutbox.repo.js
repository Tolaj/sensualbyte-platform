export function eventsOutboxRepo(db) {
    const col = db.collection("events_outbox");
    return { enqueue: async (doc) => { await col.insertOne(doc); return doc; } };
}
