// apps/api/src/controllers/resources.controller.js
import { resourcesService } from "../services/resources.service.js";

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}

function badRequest(message, details = null) {
    return httpError(400, message, details);
}

function unauthorized(message = "Unauthorized", details = null) {
    return httpError(401, message, details);
}

function isPlainObject(v) {
    return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireNonEmptyString(value, field) {
    const s = String(value ?? "").trim();
    if (!s) throw badRequest(`${field} is required`);
    return s;
}

function actorFromReq(req) {
    const userId = typeof req.userId === "string" ? req.userId.trim() : "";
    if (!userId) throw unauthorized("Unauthorized");
    return { userId, isSuperAdmin: req.isSuperAdmin === true };
}

export function resourcesController(db) {
    const svc = resourcesService(db);

    return {
        create: async (req, res) => {
            const actor = actorFromReq(req);

            if (req.body !== undefined && req.body !== null && !isPlainObject(req.body)) {
                throw badRequest("body must be a JSON object");
            }

            const { projectId, catalogId, name, overrides } = req.body || {};
            if (!projectId || !catalogId || !name) {
                throw badRequest("projectId, catalogId, name are required", { projectId, catalogId, name });
            }
            if (overrides !== undefined && overrides !== null && !isPlainObject(overrides)) {
                throw badRequest("overrides must be an object");
            }

            const out = await svc.createFromCatalog({
                projectId: String(projectId),
                catalogId: String(catalogId),
                name: String(name),
                overrides: overrides || {},
                actor
            });

            res.status(201).json(out);
        },

        list: async (req, res) => {
            const actor = actorFromReq(req);

            const projectId = req.query.projectId ? String(req.query.projectId) : null;
            const kindRaw = req.query.kind ? String(req.query.kind) : null;
            const kind = kindRaw && kindRaw.trim() ? kindRaw.trim() : null;

            res.json(await svc.list({ projectId, kind, actor }));
        },

        get: async (req, res) => {
            const actor = actorFromReq(req);
            const resourceId = requireNonEmptyString(req.params.resourceId, "resourceId");

            res.json(await svc.get(resourceId, actor));
        },

        patch: async (req, res) => {
            const actor = actorFromReq(req);
            const resourceId = requireNonEmptyString(req.params.resourceId, "resourceId");

            if (req.body !== undefined && req.body !== null && !isPlainObject(req.body)) {
                throw badRequest("body must be a JSON object");
            }

            res.json(await svc.patch(resourceId, req.body || {}, actor));
        },

        remove: async (req, res) => {
            const actor = actorFromReq(req);
            const resourceId = requireNonEmptyString(req.params.resourceId, "resourceId");

            // delete/admin enforcement happens inside service
            res.json(await svc.remove(resourceId, actor));
        }
    };
}
