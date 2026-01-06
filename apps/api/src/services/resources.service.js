import { newId } from "../utils/ids.js";
import { now } from "../utils/time.js";
import { catalogItemsRepo } from "../repos/catalogItems.repo.js";
import { resourcesRepo } from "../repos/resources.repo.js";
import { resourceStatusRepo } from "../repos/resourceStatus.repo.js";
import { eventsOutboxRepo } from "../repos/eventsOutbox.repo.js";
import { secretsRepo } from "../repos/secrets.repo.js";
import { applyOfferingDefaults } from "./catalog.service.js";
import { encryptString } from "../../../../packages/shared/crypto.js";

function randPassword() {
    return (
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Date.now().toString(36)
    ).slice(0, 32);
}

function defaultHostname({ projectId, name }) {
    // v1 local-friendly (you can swap later to real domains)
    return `${name}.${projectId}.local`.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

export function resourcesService(db) {
    const catalog = catalogItemsRepo(db);
    const resources = resourcesRepo(db);
    const status = resourceStatusRepo(db);
    const outbox = eventsOutboxRepo(db);
    const secrets = secretsRepo(db);

    async function enqueueResourceChanged(resourceId, reason, actorUserId = null) {
        await outbox.enqueue({
            eventId: newId("evt"),
            type: "RESOURCE_CHANGED",
            resourceType: "resource",
            resourceId,
            payload: { reason, actorUserId },
            processed: false,
            processedAt: null,
            lock: null,
            attempts: 0,
            lastError: null,
            updatedAt: now(),
            createdAt: now()
        });
    }

    async function initStatus(resourceId, msg = "Queued for reconciliation") {
        await status.upsert(resourceId, {
            observedGeneration: 0,
            state: "creating",
            message: msg,
            details: null,
            lastUpdatedAt: now()
        });
    }

    async function maybeCreatePostgresPasswordSecret({ createdBy, projectId, resourceId, spec }) {
        // If user already supplied passwordSecretRef -> do nothing
        if (spec.passwordSecretRef) return spec;

        const passwordPlain = randPassword();
        const enc = encryptString(passwordPlain);
        const secretId = newId("sec");

        await secrets.create({
            secretId,
            storeId: "store_local",
            scopeType: "resource",
            scopeId: resourceId,
            name: "db/password",
            type: "db_password",
            ciphertext: enc.ciphertext,
            encryptionMeta: enc.encryptionMeta,
            createdBy,
            createdAt: now()
        });

        return { ...spec, passwordSecretRef: secretId };
    }

    async function maybeCreatePublicRouteChild({ createdBy, rootResource }) {
        if (rootResource.kind !== "compute") return null;

        const exposure = rootResource.spec?.network?.exposure || "internal";
        const port = rootResource.spec?.network?.internalPort || null;

        // only auto-route for public + has internalPort
        if (exposure !== "public" || !port) return null;

        const routeResourceId = newId("res");
        const hostname = defaultHostname({ projectId: rootResource.projectId, name: rootResource.name });

        const routeDoc = {
            resourceId: routeResourceId,
            projectId: rootResource.projectId,
            kind: "http_route",
            name: `${rootResource.name}-route`,
            spec: {
                hostname,
                pathPrefix: null,
                targetResourceId: rootResource.resourceId,
                targetPort: port,
                protocol: "http"
            },
            desiredState: "active",
            labels: { "sensual.platformManaged": "true" },
            generation: 1,
            createdBy,
            createdAt: now(),
            updatedAt: now(),
            parentResourceId: rootResource.resourceId,
            rootResourceId: rootResource.resourceId
        };

        await resources.insert(routeDoc);
        await initStatus(routeResourceId, "Queued for route reconciliation");
        await enqueueResourceChanged(routeResourceId, "auto_create_route", createdBy);

        return routeDoc;
    }

    return {
        async createFromCatalog({ projectId, catalogId, name, overrides, createdBy }) {
            const item = await catalog.getByCatalogId(catalogId);
            if (!item) {
                const e = new Error(`Unknown catalogId: ${catalogId}`);
                e.statusCode = 404;
                throw e;
            }

            const rootResourceId = newId("res");
            const createdAt = now();

            // build spec
            let spec = applyOfferingDefaults(item, overrides || {});

            // If postgres, generate + store password secret now (API side)
            if (item.kind === "postgres") {
                spec = await maybeCreatePostgresPasswordSecret({
                    createdBy,
                    projectId,
                    resourceId: rootResourceId,
                    spec
                });
            }

            const rootDoc = {
                resourceId: rootResourceId,
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
                parentResourceId: null,
                rootResourceId: null
            };

            await resources.insert(rootDoc);
            await initStatus(rootResourceId);
            await enqueueResourceChanged(rootResourceId, "create", createdBy);

            // auto-create http_route child for public compute
            const childRoute = await maybeCreatePublicRouteChild({ createdBy, rootResource: rootDoc });

            return { resource: rootDoc, createdChildren: childRoute ? [childRoute] : [] };
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
            return { resources: await resources.list({ projectId, kind }) };
        },

        async patch(resourceId, patch, actorUserId) {
            const existing = await resources.getByResourceId(resourceId);
            if (!existing) {
                const e = new Error(`Resource not found: ${resourceId}`);
                e.statusCode = 404;
                throw e;
            }

            const updated = await resources.update(resourceId, {
                ...patch,
                generation: (existing.generation || 0) + 1,
                updatedAt: now()
            });

            await enqueueResourceChanged(resourceId, "update", actorUserId);
            return { resource: updated };
        },

        async remove(resourceId, actorUserId) {
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
                state: "deleting",
                message: "Deletion requested",
                lastUpdatedAt: now()
            });

            await enqueueResourceChanged(resourceId, "delete", actorUserId);
            return { resource: updated };
        }
    };
}
