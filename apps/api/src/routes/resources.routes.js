import { Router } from "express";
import { resourcesController } from "../controllers/resources.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/iam.js";
import { asyncHandler } from "../utils/http.js";

function requireDb(req) {
    const db = req.ctx?.db;
    if (!db) {
        const e = new Error("Request context misconfigured: db not available");
        e.statusCode = 500;
        throw e;
    }
    return db;
}

function globalScope() {
    return [{ scopeType: "global", scopeId: "global" }];
}

function projectTeamScopes(projectId, teamId) {
    const pid = String(projectId || "").trim();
    const tid = String(teamId || "").trim();

    const scopes = [];
    if (pid) scopes.push({ scopeType: "project", scopeId: pid });
    if (tid) scopes.push({ scopeType: "team", scopeId: tid });
    scopes.push({ scopeType: "global", scopeId: "global" });

    return scopes;
}

/**
 * Middleware: load resource -> projectId -> teamId for IAM scope resolution.
 * Caches result in req.ctx.resourceScope for this request.
 */
function withResourceScope() {
    return async (req, _res, next) => {
        try {
            const db = requireDb(req);
            const resourceId = String(req.params.resourceId || "").trim();
            if (!resourceId) {
                const e = new Error("resourceId required");
                e.statusCode = 400;
                throw e;
            }

            const doc = await db
                .collection("resources")
                .findOne(
                    { resourceId },
                    { projection: { _id: 0, resourceId: 1, projectId: 1 } }
                );

            if (!doc) {
                const e = new Error("Not found");
                e.statusCode = 404;
                throw e;
            }

            const projectId = String(doc.projectId || "").trim();
            if (!projectId) {
                const e = new Error("Resource missing projectId");
                e.statusCode = 500;
                throw e;
            }

            const p = await db
                .collection("projects")
                .findOne(
                    { projectId },
                    { projection: { _id: 0, projectId: 1, teamId: 1 } }
                );

            if (!p) {
                const e = new Error("Project not found for resource");
                e.statusCode = 500;
                throw e;
            }

            const teamId = String(p.teamId || "").trim();
            if (!teamId) {
                const e = new Error("Project missing teamId");
                e.statusCode = 500;
                throw e;
            }

            req.ctx.resourceScope = { projectId, teamId, resourceId };
            return next();
        } catch (err) {
            return next(err);
        }
    };
}

export function resourcesRoutes() {
    const r = Router();
    r.use(requireAuth());

    const ctrl = (req) => resourcesController(requireDb(req));

    // CREATE: projectId comes from body, but teamId needs lookup.
    // ✅ We'll resolve teamId inside scopeResolver via small lookup.
    r.post(
        "/",
        requirePermission("resource.create", async (req) => {
            const db = requireDb(req);
            const projectId = String(req.body?.projectId || "").trim();
            if (!projectId) return globalScope(); // will error in requirePermission as misconfigured
            const p = await db.collection("projects").findOne(
                { projectId },
                { projection: { _id: 0, teamId: 1 } }
            );
            return projectTeamScopes(projectId, p?.teamId);
        }),
        asyncHandler((req, res) => ctrl(req).create(req, res))
    );

    // LIST: requires projectId filter
    r.get(
        "/",
        requirePermission("resource.list", async (req) => {
            const db = requireDb(req);
            const projectId = String(req.query?.projectId || "").trim();
            if (!projectId) return globalScope();
            const p = await db.collection("projects").findOne(
                { projectId },
                { projection: { _id: 0, teamId: 1 } }
            );
            return projectTeamScopes(projectId, p?.teamId);
        }),
        asyncHandler((req, res) => ctrl(req).list(req, res))
    );

    // GET by id: derive projectId + teamId from resource
    r.get(
        "/:resourceId",
        withResourceScope(),
        requirePermission("resource.read", (req) =>
            projectTeamScopes(req.ctx.resourceScope?.projectId, req.ctx.resourceScope?.teamId)
        ),
        asyncHandler((req, res) => ctrl(req).get(req, res))
    );

    // PATCH by id
    r.patch(
        "/:resourceId",
        withResourceScope(),
        requirePermission("resource.update", (req) =>
            projectTeamScopes(req.ctx.resourceScope?.projectId, req.ctx.resourceScope?.teamId)
        ),
        asyncHandler((req, res) => ctrl(req).patch(req, res))
    );

    // DELETE by id
    r.delete(
        "/:resourceId",
        withResourceScope(),
        requirePermission("resource.delete", (req) =>
            projectTeamScopes(req.ctx.resourceScope?.projectId, req.ctx.resourceScope?.teamId)
        ),
        asyncHandler((req, res) => ctrl(req).remove(req, res))
    );

    return r;
}
