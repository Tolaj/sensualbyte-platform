import { resourcesService } from "../services/resources.service.js";

export function resourcesController(db) {
    const svc = resourcesService(db);

    return {
        async create(req, res) {
            // TEMP (Step 3 adds auth/RBAC). For now use header or dummy.
            const createdBy = req.headers["x-user-id"] || "user_demo";

            const { projectId, catalogId, name, overrides } = req.body || {};
            if (!projectId || !catalogId || !name) {
                const e = new Error("projectId, catalogId, name are required");
                e.statusCode = 400;
                throw e;
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

        async list(req, res) {
            const projectId = req.query.projectId || null;
            const kind = req.query.kind || null;
            const out = await svc.list({ projectId, kind });
            res.json(out);
        },

        async get(req, res) {
            const out = await svc.get(req.params.resourceId);
            res.json(out);
        },

        async update(req, res) {
            const actorUserId = req.headers["x-user-id"] || "user_demo";
            const patch = req.body || {};
            const out = await svc.update(req.params.resourceId, patch, actorUserId);
            res.json(out);
        },

        async remove(req, res) {
            const actorUserId = req.headers["x-user-id"] || "user_demo";
            const out = await svc.delete(req.params.resourceId, actorUserId);
            res.json(out);
        }
    };
}
