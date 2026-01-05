import { newId } from "../utils/ids.js";
import { deepMerge } from "./catalog.service.js";

import { catalogItemsRepo } from "../repos/catalogItems.repo.js";
import { resourcesRepo } from "../repos/resources.repo.js";
import { resourceStatusRepo } from "../repos/resourceStatus.repo.js";
import { eventsOutboxRepo } from "../repos/eventsOutbox.repo.js";

function now() {
    return new Date();
}

export function resourcesService(db) {
    const catalog = catalogItemsRepo(db);
    const resources = resourcesRepo(db);
    const status = resourceStatusRepo(db);
    const outbox = eventsOutboxRepo(db);

    return {
        /**
         * Create resource from an offering (catalogId) + user overrides.
         * This is your main "Create Service" flow.
         */
        async createFromCatalog({ projectId, catalogId, name, overrides = {}, createdBy }) {
            const item = await catalog.getByCatalogId(catalogId);
            if (!item) {
                const e = new Error(`Unknown catalogId: ${catalogId}`);
                e.statusCode = 404;
                throw e;
            }

            const resourceId = newId("res");
            const createdAt = now();

            // Apply defaults, then overlay user overrides
            const spec = deepMerge(item.defaults || {}, overrides || {});

            const doc = {
                resourceId,
                projectId,
                kind: item.kind,
                name,
                spec,
                desiredState: "active",
                labels: null,
                generation: 1,
                createdBy,
                createdAt,
                updatedAt: createdAt,

                // for future composition (optional)
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
                createdAt: now(),
                processedAt: null
            });

            return { resource: doc };
        },

        async get(resourceId) {
            const r = await resources.getByResourceId(resourceId);
            if (!r) {
                const e = new Error(`Resource not found: ${resourceId}`);
                e.statusCode = 404;
                throw e;
            }
            const s = await status.get(resourceId);
            return { resource: r, status: s };
        },

        async list({ projectId, kind }) {
            const rows = await resources.list({ projectId, kind });
            return { resources: rows };
        },

        async update(resourceId, patch, actorUserId) {
            const existing = await resources.getByResourceId(resourceId);
            if (!existing) {
                const e = new Error(`Resource not found: ${resourceId}`);
                e.statusCode = 404;
                throw e;
            }

            const next = {
                ...patch,
                generation: (existing.generation || 0) + 1,
                updatedAt: now()
            };

            const updated = await resources.update(resourceId, next);

            await outbox.enqueue({
                eventId: newId("evt"),
                type: "RESOURCE_CHANGED",
                resourceType: "resource",
                resourceId,
                payload: { reason: "update", actorUserId },
                processed: false,
                createdAt: now(),
                processedAt: null
            });

            // status stays last-known until worker updates it
            return { resource: updated };
        },

        async delete(resourceId, actorUserId) {
            const existing = await resources.getByResourceId(resourceId);
            if (!existing) {
                const e = new Error(`Resource not found: ${resourceId}`);
                e.statusCode = 404;
                throw e;
            }

            const updated = await resources.update(resourceId, {
                desiredState: "deleted",
                generation: (existing.generation || 0) + 1,
                updatedAt: now()
            });

            await status.upsert(resourceId, {
                observedGeneration: existing.generation || 0,
                state: "deleting",
                message: "Deletion requested",
                lastUpdatedAt: now()
            });

            await outbox.enqueue({
                eventId: newId("evt"),
                type: "RESOURCE_CHANGED",
                resourceType: "resource",
                resourceId,
                payload: { reason: "delete", actorUserId },
                processed: false,
                createdAt: now(),
                processedAt: null
            });

            return { resource: updated };
        }
    };
}
