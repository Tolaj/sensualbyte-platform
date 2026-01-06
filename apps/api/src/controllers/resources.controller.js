import { resourcesService } from "../services/resources.service.js";

export function resourcesController(db) {
    const svc = resourcesService(db);

    return {
        create: async (req, res) => {
            const createdBy = req.userId || "user_demo";
            const { projectId, catalogId, name, overrides } = req.body || {};
            if (!projectId || !catalogId || !name) { const e = new Error("projectId,catalogId,name required"); e.statusCode = 400; throw e; }
            const out = await svc.createFromCatalog({ projectId, catalogId, name, overrides: overrides || {}, createdBy });
            res.status(201).json(out);
        },
        list: async (req, res) => res.json(await svc.list({ projectId: req.query.projectId || null, kind: req.query.kind || null })),
        get: async (req, res) => res.json(await svc.get(req.params.resourceId)),
        patch: async (req, res) => res.json(await svc.patch(req.params.resourceId, req.body || {}, req.userId || "user_demo")),
        remove: async (req, res) => res.json(await svc.remove(req.params.resourceId, req.userId || "user_demo"))
    };
}
