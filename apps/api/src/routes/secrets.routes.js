// apps/api/src/routes/secrets.routes.js
import { Router } from "express";
import { secretsController } from "../controllers/secrets.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/iam.js";
import { asyncHandler } from "../utils/http.js";

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}

function requireDb(req) {
    const db = req.ctx?.db;
    if (!db) throw httpError(500, "Request context misconfigured: db not available");
    return db;
}

function globalScope() {
    return [{ scopeType: "global", scopeId: "global" }];
}

function scopesForProjectTeam(projectId, teamId) {
    const pid = String(projectId || "").trim();
    const tid = String(teamId || "").trim();
    return [
        { scopeType: "project", scopeId: pid },
        { scopeType: "team", scopeId: tid },
        { scopeType: "global", scopeId: "global" },
    ];
}

function scopesForTeam(teamId) {
    const tid = String(teamId || "").trim();
    return [
        { scopeType: "team", scopeId: tid },
        { scopeType: "global", scopeId: "global" },
    ];
}

function scopesForUser(userId) {
    const uid = String(userId || "").trim();
    return [
        { scopeType: "user", scopeId: uid },
        { scopeType: "global", scopeId: "global" },
    ];
}

/**
 * Resolve a (scopeType, scopeId) into project/team where applicable,
 * preserving legacy semantics: team binding => project access.
 */
async function resolveToProjectTeam(db, scopeType, scopeId) {
    const st = String(scopeType || "").trim();
    const sid = String(scopeId || "").trim();
    if (!st || !sid) return null;

    if (st === "project") {
        const p = await db
            .collection("projects")
            .findOne({ projectId: sid }, { projection: { _id: 0, projectId: 1, teamId: 1 } });
        if (!p) throw httpError(404, "Project not found", { projectId: sid });
        return { projectId: p.projectId, teamId: p.teamId };
    }

    if (st === "resource") {
        const r = await db
            .collection("resources")
            .findOne({ resourceId: sid }, { projection: { _id: 0, resourceId: 1, projectId: 1 } });
        if (!r) throw httpError(404, "Resource not found", { resourceId: sid });

        const p = await db
            .collection("projects")
            .findOne({ projectId: String(r.projectId) }, { projection: { _id: 0, projectId: 1, teamId: 1 } });
        if (!p) throw httpError(404, "Project not found", { projectId: String(r.projectId) });

        return { projectId: p.projectId, teamId: p.teamId };
    }

    return null;
}

/**
 * Middleware: validate + normalize list scope.
 * Supports:
 *  - /v1/secrets?scopeType=project&scopeId=proj_xxx
 *  - /v1/secrets?projectId=proj_xxx  (maps to project scope)
 */
function withListScope() {
    return async (req, _res, next) => {
        try {
            const db = requireDb(req);
            const projectId = String(req.query?.projectId || "").trim();
            const scopeType = String(req.query?.scopeType || "").trim();
            const scopeId = String(req.query?.scopeId || "").trim();

            let st = scopeType;
            let sid = scopeId;
            if (projectId) {
                st = "project";
                sid = projectId;
            }

            if (!st || !sid) throw httpError(400, "scopeType & scopeId required (or projectId)");

            const resolved = await resolveToProjectTeam(db, st, sid);
            req.ctx.listScope = {
                scopeType: st,
                scopeId: sid,
                projectId: resolved?.projectId || null,
                teamId: resolved?.teamId || null,
            };
            return next();
        } catch (err) {
            return next(err);
        }
    };
}

/**
 * Middleware: load secret -> scopeType/scopeId -> (projectId, teamId) if applicable.
 * Caches in req.ctx.secretScope.
 */
function withSecretScope() {
    return async (req, _res, next) => {
        try {
            const db = requireDb(req);
            const secretId = String(req.params.secretId || "").trim();
            if (!secretId) throw httpError(400, "secretId required");

            const doc = await db
                .collection("secrets")
                .findOne(
                    { secretId },
                    { projection: { _id: 0, secretId: 1, scopeType: 1, scopeId: 1 } }
                );

            if (!doc) throw httpError(404, "Not found");

            const st = String(doc.scopeType || "").trim();
            const sid = String(doc.scopeId || "").trim();
            if (!st || !sid) throw httpError(500, "Secret missing scopeType/scopeId");

            const resolved = await resolveToProjectTeam(db, st, sid);

            req.ctx.secretScope = {
                secretId,
                scopeType: st,
                scopeId: sid,
                projectId: resolved?.projectId || null,
                teamId: resolved?.teamId || null,
            };

            return next();
        } catch (err) {
            return next(err);
        }
    };
}

function listIamScopes(req) {
    const s = req.ctx?.listScope;
    if (!s) return globalScope();

    if (s.projectId && s.teamId) return scopesForProjectTeam(s.projectId, s.teamId);
    if (s.scopeType === "team") return scopesForTeam(s.scopeId);
    if (s.scopeType === "user") return scopesForUser(s.scopeId);
    return globalScope();
}

function secretIamScopes(req) {
    const s = req.ctx?.secretScope;
    if (!s) return globalScope();

    if (s.projectId && s.teamId) return scopesForProjectTeam(s.projectId, s.teamId);
    if (s.scopeType === "team") return scopesForTeam(s.scopeId);
    if (s.scopeType === "user") return scopesForUser(s.scopeId);
    return globalScope();
}

export function secretsRoutes() {
    const r = Router();
    r.use(requireAuth());

    const ctrl = (req) => secretsController(requireDb(req));

    // LIST: keep backward-compatible access (project_viewer has secret.read)
    r.get(
        "/",
        withListScope(),
        requirePermission("secret.read", listIamScopes),
        asyncHandler((req, res) => ctrl(req).list(req, res))
    );

    // GET: derive scope from secret (meta read)
    r.get(
        "/:secretId",
        withSecretScope(),
        requirePermission("secret.read", secretIamScopes),
        asyncHandler((req, res) => ctrl(req).get(req, res))
    );

    // one-time ssh private key download (seed mentions secret.ssh_key.download)
    r.get(
        "/:secretId/ssh-key",
        withSecretScope(),
        requirePermission("secret.ssh_key.download", secretIamScopes),
        asyncHandler((req, res) => ctrl(req).downloadSshKey(req, res))
    );

    return r;
}
