// apps/api/src/routes/identity.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { identityController } from "../controllers/identity.controller.js";
import { asyncHandler } from "../utils/http.js";
import { requirePermission } from "../middleware/iam.js";

function globalScope() {
    return [{ scopeType: "global", scopeId: "global" }];
}

function teamScope(req) {
    return [
        { scopeType: "team", scopeId: String(req.params.teamId || "").trim() },
        { scopeType: "global", scopeId: "global" },
    ];
}

function bindingScopeFromQuery(req) {
    return [
        { scopeType: String(req.query.scopeType || "").trim(), scopeId: String(req.query.scopeId || "").trim() },
        { scopeType: "global", scopeId: "global" },
    ];
}

function bindingScopeFromBody(req) {
    return [
        { scopeType: String(req.body?.scopeType || "").trim(), scopeId: String(req.body?.scopeId || "").trim() },
        { scopeType: "global", scopeId: "global" },
    ];
}

function resolveDb(req) {
    return (
        req?.ctx?.db ||
        req?.app?.locals?.db ||
        req?.ctx?.mongo?.db ||
        null
    );
}

export function identityRoutes() {
    const r = Router();

    // Make sure req.ctx exists
    r.use((req, _res, next) => {
        req.ctx = req.ctx || {};
        // If app.locals.db exists, attach it for this router
        const db = resolveDb(req);
        if (db && !req.ctx.db) req.ctx.db = db;
        next();
    });

    r.use(requireAuth());

    const ctrl = (req) => {
        const db = resolveDb(req);
        if (!db) {
            const e = new Error(
                "Database not available on request context. Expected req.ctx.db or app.locals.db."
            );
            e.statusCode = 500;
            e.details = { hasCtx: !!req.ctx, hasCtxDb: !!req.ctx?.db, hasAppLocalsDb: !!req.app?.locals?.db };
            throw e;
        }
        return identityController(db);
    };

    // USERS
    r.get("/users", asyncHandler((req, res) => ctrl(req).listUsers(req, res)));
    r.post("/users", asyncHandler((req, res) => ctrl(req).createUser(req, res)));

    // TEAMS
    r.get("/teams", asyncHandler((req, res) => ctrl(req).listTeams(req, res)));
    r.post("/teams", asyncHandler((req, res) => ctrl(req).createTeam(req, res)));

    // TEAM MEMBERS
    r.get(
        "/teams/:teamId/members",
        requirePermission("team.members.read", teamScope),
        asyncHandler((req, res) => ctrl(req).listTeamMembers(req, res))
    );
    r.post(
        "/teams/:teamId/members",
        requirePermission("team.members.write", teamScope),
        asyncHandler((req, res) => ctrl(req).addTeamMember(req, res))
    );
    r.delete(
        "/teams/:teamId/members/:userId",
        requirePermission("team.members.write", teamScope),
        asyncHandler((req, res) => ctrl(req).removeTeamMember(req, res))
    );

    // IAM ROLES
    r.get("/iam/roles", asyncHandler((req, res) => ctrl(req).listIamRoles(req, res)));

    r.get(
        "/iam/roles/:roleId",
        requirePermission("iam.*", globalScope),
        asyncHandler((req, res) => ctrl(req).getIamRole(req, res))
    );
    r.post(
        "/iam/roles",
        requirePermission("iam.*", globalScope),
        asyncHandler((req, res) => ctrl(req).createIamRole(req, res))
    );
    r.patch(
        "/iam/roles/:roleId",
        requirePermission("iam.*", globalScope),
        asyncHandler((req, res) => ctrl(req).updateIamRole(req, res))
    );
    r.delete(
        "/iam/roles/:roleId",
        requirePermission("iam.*", globalScope),
        asyncHandler((req, res) => ctrl(req).deleteIamRole(req, res))
    );

    // IAM BINDINGS
    r.get(
        "/iam/bindings",
        requirePermission("iam.bindings.read", bindingScopeFromQuery),
        asyncHandler((req, res) => ctrl(req).listIamBindings(req, res))
    );
    r.post(
        "/iam/bindings",
        requirePermission("iam.bindings.write", bindingScopeFromBody),
        asyncHandler((req, res) => ctrl(req).grantIamBinding(req, res))
    );
    r.delete(
        "/iam/bindings",
        requirePermission("iam.bindings.write", bindingScopeFromBody),
        asyncHandler((req, res) => ctrl(req).revokeIamBinding(req, res))
    );

    return r;
}
