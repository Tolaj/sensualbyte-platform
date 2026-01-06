import { resourcesService } from "../services/resources.service.js";

function badRequest(message, details = null) {
    const e = new Error(message);
    e.statusCode = 400;
    if (details) e.details = details;
    return e;
}

export function resourcesController(db) {
    const svc = resourcesService(db);

    return {
        create: async (req, res) => {
            const createdBy = req.userId || "user_demo";

            const { projectId, catalogId, name, overrides } = req.body || {};
            if (!projectId || !catalogId || !name) {
                throw badRequest("projectId, catalogId, name are required", { projectId, catalogId, name });
            }
            if (overrides && typeof overrides !== "object") {
                throw badRequest("overrides must be an object");
            }

            const out = await svc.createFromCatalog({
                projectId,
                catalogId,
                name,
                overrides: overrides || {},
                createdBy
            });

            res.status(201).json(out);
        },

        list: async (req, res) => {
            const projectId = req.query.projectId ? String(req.query.projectId) : null;
            const kind = req.query.kind ? String(req.query.kind) : null;
            res.json(await svc.list({ projectId, kind }));
        },

        get: async (req, res) => {
            res.json(await svc.get(String(req.params.resourceId)));
        },

        patch: async (req, res) => {
            const resourceId = String(req.params.resourceId);
            const actor = req.userId || "user_demo";
            res.json(await svc.patch(resourceId, req.body || {}, actor));
        },

        remove: async (req, res) => {
            const resourceId = String(req.params.resourceId);
            const actor = req.userId || "user_demo";
            res.json(await svc.remove(resourceId, actor));
        }
    };
}
