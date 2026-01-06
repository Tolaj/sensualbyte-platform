import { newId } from "../utils/ids.js";
import { now } from "../utils/time.js";

import { catalogItemsRepo } from "../repos/catalogItems.repo.js";
import { resourcesRepo } from "../repos/resources.repo.js";
import { resourceStatusRepo } from "../repos/resourceStatus.repo.js";
import { eventsOutboxRepo } from "../repos/eventsOutbox.repo.js";
import { secretsRepo } from "../repos/secrets.repo.js";

import { applyOfferingDefaults } from "./catalog.service.js";
import { encryptString } from "../../../../packages/shared/crypto.js";
import { deepMerge } from "../../../../packages/shared/offeringDefaults.js"; // ✅ deep merge for spec patches

const ALLOWED_DESIRED = new Set(["active", "paused", "deleted"]);

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}

function randPassword() {
    return (
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Date.now().toString(36)
    ).slice(0, 32);
}

function defaultHostname({ projectId, name }) {
    return `${name}.${projectId}.local`.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
}

function isPlainObject(v) {
    return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function pickPatch(patch) {
    const out = {};

    if (typeof patch?.name === "string") out.name = patch.name;

    if (patch?.labels !== undefined) {
        if (patch.labels === null) out.labels = null;
        else if (!isPlainObject(patch.labels)) throw httpError(400, "labels must be an object or null");
        else out.labels = patch.labels;
    }

    if (patch?.desiredState !== undefined) {
        const ds = String(patch.desiredState);
        if (!ALLOWED_DESIRED.has(ds)) throw httpError(400, `Invalid desiredState: ${ds}`);
        out.desiredState = ds;
    }

    if (patch?.spec !== undefined) {
        if (!isPlainObject(patch.spec)) throw httpError(400, "spec must be an object");
        out.spec = patch.spec;
    }

    return out;
}

export function resourcesService(db) {
    const catalog = catalogItemsRepo(db);
    const resources = resourcesRepo(db);
    const status = resourceStatusRepo(db);
    const outbox = eventsOutboxRepo(db);
    const secrets = secretsRepo(db);

    async function enqueueResourceChanged(resourceId, reason, actorUserId = null) {
        // make enqueue idempotent even if insert collides
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

    async function maybeCreatePostgresPasswordSecret({ createdBy, resourceId, spec }) {
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

        if (exposure !== "public" || !port) return null;

        const routeResourceId = newId("res");
        const hostname = defaultHostname({ projectId: rootResource.projectId, name: rootResource.name });

        const createdAt = now();

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
            createdAt,
            updatedAt: createdAt,
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
            if (!item) throw httpError(404, `Unknown catalogId: ${catalogId}`);

            const rootResourceId = newId("res");
            const createdAt = now();

            let spec = applyOfferingDefaults(item, overrides || {});

            if (item.kind === "postgres") {
                spec = await maybeCreatePostgresPasswordSecret({ createdBy, resourceId: rootResourceId, spec });
            }

            const rootDoc = {
                resourceId: rootResourceId,
                projectId,
                kind: item.kind,
                name,
                spec,
                desiredState: "active",
                labels: {},
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

            const childRoute = await maybeCreatePublicRouteChild({ createdBy, rootResource: rootDoc });

            return { resource: rootDoc, createdChildren: childRoute ? [childRoute] : [] };
        },

        async get(resourceId) {
            const r = await resources.getByResourceId(resourceId);
            if (!r) throw httpError(404, `Resource not found: ${resourceId}`);
            const s = await status.get(resourceId);
            return { resource: r, status: s };
        },

        async list({ projectId, kind }) {
            return { resources: await resources.list({ projectId, kind }) };
        },

        async patch(resourceId, patch, actorUserId) {
            const existing = await resources.getByResourceId(resourceId);
            if (!existing) throw httpError(404, `Resource not found: ${resourceId}`);

            const safe = pickPatch(patch);

            // ✅ deep merge spec updates
            if (safe.spec) {
                safe.spec = deepMerge(existing.spec || {}, safe.spec || {});
            }

            const updated = await resources.update(resourceId, {
                ...safe,
                generation: (existing.generation || 0) + 1,
                updatedAt: now()
            });

            await enqueueResourceChanged(resourceId, "update", actorUserId);
            return { resource: updated };
        },

        async remove(resourceId, actorUserId) {
            const existing = await resources.getByResourceId(resourceId);
            if (!existing) throw httpError(404, `Resource not found: ${resourceId}`);

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
