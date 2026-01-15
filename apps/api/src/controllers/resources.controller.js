// apps/api/src/controllers/resources.controller.js
import { resourcesService } from "../services/resources.service.js";

function isProd() {
    return (process.env.NODE_ENV || "development") === "production";
}

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

function safeDetails(details) {
    return isProd() ? null : details;
}

function isPlainObject(v) {
    return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireNonEmptyString(value, field) {
    const s = String(value ?? "").trim();
    if (!s) throw badRequest(`${field} is required`);
    return s;
}

function validateId(value, field) {
    const s = requireNonEmptyString(value, field);
    if (s.length > 120) throw badRequest(`${field} too long`);
    if (!/^[a-zA-Z0-9._-]+$/.test(s)) throw badRequest(`Invalid ${field}`, safeDetails({ value: s }));
    return s;
}

function validateName(value) {
    const s = requireNonEmptyString(value, "name");
    if (s.length > 160) throw badRequest("name too long");
    return s;
}

function actorFromReq(req) {
    const userId = typeof req.userId === "string" ? req.userId.trim() : "";
    if (!userId) throw unauthorized("Unauthorized");
    return { userId, isSuperAdmin: req.isSuperAdmin === true };
}

function stripImmutablePatchFields(patch) {
    // Prevent privilege escalation / data integrity issues
    const immutable = new Set([
        "resourceId",
        "projectId",
        "catalogId",
        "createdAt",
        "createdBy",
        "kind",
        "status",
    ]);

    const out = {};
    for (const [k, v] of Object.entries(patch || {})) {
        if (immutable.has(k)) continue;
        out[k] = v;
    }
    return out;
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
                throw badRequest(
                    "projectId, catalogId, name are required",
                    safeDetails({ projectId, catalogId, name })
                );
            }

            if (overrides !== undefined && overrides !== null && !isPlainObject(overrides)) {
                throw badRequest("overrides must be an object");
            }

            const out = await svc.createFromCatalog({
                projectId: validateId(projectId, "projectId"),
                catalogId: validateId(catalogId, "catalogId"),
                name: validateName(name),
                overrides: overrides || {},
                actor,
            });

            return res.status(201).json(out);
        },

        list: async (req, res) => {
            const actor = actorFromReq(req);

            // Defense-in-depth: require projectId (prevents accidental cross-project listing)
            const projectId = req.query.projectId ? validateId(req.query.projectId, "projectId") : null;
            if (!projectId) throw badRequest("projectId is required");

            const kindRaw = req.query.kind ? String(req.query.kind) : null;
            const kind = kindRaw && kindRaw.trim() ? kindRaw.trim() : null;

            return res.json(await svc.list({ projectId, kind, actor }));
        },

        get: async (req, res) => {
            const actor = actorFromReq(req);
            const resourceId = validateId(req.params.resourceId, "resourceId");
            return res.json(await svc.get(resourceId, actor));
        },

        patch: async (req, res) => {
            const actor = actorFromReq(req);
            const resourceId = validateId(req.params.resourceId, "resourceId");

            if (req.body !== undefined && req.body !== null && !isPlainObject(req.body)) {
                throw badRequest("body must be a JSON object");
            }

            const patch = stripImmutablePatchFields(req.body || {});
            return res.json(await svc.patch(resourceId, patch, actor));
        },

        remove: async (req, res) => {
            const actor = actorFromReq(req);
            const resourceId = validateId(req.params.resourceId, "resourceId");

            // delete/admin enforcement happens inside service
            return res.json(await svc.remove(resourceId, actor));
        },
    };
}
