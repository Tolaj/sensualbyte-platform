import { newId } from "../utils/ids.js";
import { now } from "../utils/time.js";
import { catalogItemsRepo } from "../repos/catalogItems.repo.js";
import { resourcesRepo } from "../repos/resources.repo.js";
import { resourceStatusRepo } from "../repos/resourceStatus.repo.js";
import { eventsOutboxRepo } from "../repos/eventsOutbox.repo.js";
import { applyOfferingDefaults } from "./catalog.service.js";

export function resourcesService(db) {
    const catalog = catalogItemsRepo(db);
    const resources = resourcesRepo(db);
    const status = resourceStatusRepo(db);
    const outbox = eventsOutboxRepo(db);

    return {
        async createFromCatalog({ projectId, catalogId, name, overrides, createdBy }) {
            const item = await catalog.getByCatalogId(catalogId);
            if (!item) { const e = new Error(`Unknown catalogId: ${catalogId}`); e.statusCode = 404; throw e; }

            const resourceId = newId("res");
            const createdAt = now();
            const spec = applyOfferingDefaults(item, overrides);

            const doc = {
                resourceId, projectId, kind: item.kind, name, spec,
                desiredState: "active",
                labels: null,
                generation: 1,
                createdBy,
                createdAt,
                updatedAt: createdAt,
                parentResourceId: null,
                rootResourceId: null
            };

            await resources.insert(doc);

            await status.upsert(resourceId, {
                observedGeneration: 0,
                state: "creating",
                message: "Queued for reconciliation",
                details: null,
                lastUpdatedAt: now()
            });

            await outbox.enqueue({
                eventId: newId("evt"),
                type: "RESOURCE_CHANGED",
                resourceType: "resource",
                resourceId,
                payload: { reason: "create" },
                processed: false,
                processedAt: null,
                lock: null,
                attempts: 0,
                lastError: null,
                updatedAt: now(),
                createdAt: now()
            });

            return { resource: doc };
        },

        async get(resourceId) {
            const r = await resources.getByResourceId(resourceId);
            if (!r) { const e = new Error(`Resource not found: ${resourceId}`); e.statusCode = 404; throw e; }
            const s = await status.get(resourceId);
            return { resource: r, status: s };
        },

        async list({ projectId, kind }) {
            return { resources: await resources.list({ projectId, kind }) };
        },

        async patch(resourceId, patch, actorUserId) {
            const existing = await resources.getByResourceId(resourceId);
            if (!existing) { const e = new Error(`Resource not found: ${resourceId}`); e.statusCode = 404; throw e; }

            const updated = await resources.update(resourceId, { ...patch, generation: (existing.generation || 0) + 1, updatedAt: now() });

            await outbox.enqueue({
                eventId: newId("evt"),
                type: "RESOURCE_CHANGED",
                resourceType: "resource",
                resourceId,
                payload: { reason: "update", actorUserId },
                processed: false,
                processedAt: null,
                lock: null,
                attempts: 0,
                lastError: null,
                updatedAt: now(),
                createdAt: now()
            });

            return { resource: updated };
        },

        async remove(resourceId, actorUserId) {
            const existing = await resources.getByResourceId(resourceId);
            if (!existing) { const e = new Error(`Resource not found: ${resourceId}`); e.statusCode = 404; throw e; }

            const updated = await resources.update(resourceId, { desiredState: "deleted", generation: (existing.generation || 0) + 1, updatedAt: now() });

            await status.upsert(resourceId, { state: "deleting", message: "Deletion requested", lastUpdatedAt: now() });

            await outbox.enqueue({
                eventId: newId("evt"),
                type: "RESOURCE_CHANGED",
                resourceType: "resource",
                resourceId,
                payload: { reason: "delete", actorUserId },
                processed: false,
                processedAt: null,
                lock: null,
                attempts: 0,
                lastError: null,
                updatedAt: now(),
                createdAt: now()
            });

            return { resource: updated };
        }
    };
}
