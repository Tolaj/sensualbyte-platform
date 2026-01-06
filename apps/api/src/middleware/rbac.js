import { rbacService } from "../services/rbac.service.js";

export function requireProjectRole(minRole = "viewer") {
    return async (req, _res, next) => {
        try {
            const projectId = req.params.projectId || req.body?.projectId || req.query?.projectId;
            if (!projectId) return next(); // allow endpoints that don't have project context
            await rbacService(req.ctx.db).requireResourceRole({
                userId: req.userId,
                resourceType: "project",
                resourceId: projectId,
                minRole
            });
            next();
        } catch (e) {
            next(e);
        }
    };
}

export function requireResourceRole(minRole = "viewer") {
    return async (req, _res, next) => {
        try {
            const resourceId = req.params.resourceId;
            if (!resourceId) return next();
            await rbacService(req.ctx.db).requireResourceRole({
                userId: req.userId,
                resourceType: "resource",
                resourceId,
                minRole
            });
            next();
        } catch (e) {
            next(e);
        }
    };
}
