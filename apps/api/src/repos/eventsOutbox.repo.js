export function eventsOutboxRepo(db) {
    const col = db.collection("events_outbox");
    return {
        async enqueue(event) {
            await col.insertOne(event);
            return event;
        }
    };
}
