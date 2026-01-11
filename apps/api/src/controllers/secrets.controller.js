// apps/api/src/controllers/secrets.controller.js
import { secretsService } from "../services/secrets.service.js";

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
function forbidden(message = "Forbidden", details = null) {
    return httpError(403, message, details);
}
function notFound(message = "Not found", details = null) {
    return httpError(404, message, details);
}

function actorFromReq(req) {
    const userId = typeof req.userId === "string" ? req.userId.trim() : "";
    if (!userId) throw unauthorized();
    return { userId, isSuperAdmin: req.isSuperAdmin === true };
}

// Your current schema allows only: project/resource/user
const TEAM_READ = ["team_owner", "team_member", "team_viewer"];
const TEAM_VALUE = ["team_owner"];

const PROJECT_READ = ["project_owner", "project_editor", "project_viewer"];
const PROJECT_VALUE = ["project_owner", "project_editor"]; // value is more sensitive than metadata

async function getProjectOr404(db, projectId) {
    const p = await db.collection("projects").findOne({ projectId: String(projectId) });
    if (!p) throw notFound("Project not found", { projectId });
    return p;
}

async function projectBindingExists(db, { projectId, teamId, actorUserId, projectRoles, teamRoles }) {
    return db.collection("iam_bindings").findOne({
        subjectType: "user",
        subjectId: String(actorUserId),
        $or: [
            { scopeType: "project", scopeId: String(projectId), roleId: { $in: projectRoles } },
            { scopeType: "team", scopeId: String(teamId), roleId: { $in: teamRoles } }
        ]
    });
}

async function teamBindingExists(db, { teamId, actorUserId, teamRoles }) {
    return db.collection("iam_bindings").findOne({
        scopeType: "team",
        scopeId: String(teamId),
        subjectType: "user",
        subjectId: String(actorUserId),
        roleId: { $in: teamRoles }
    });
}

async function resolveSecretScopeToProject(db, scopeType, scopeId) {
    const st = String(scopeType);
    const sid = String(scopeId);

    if (st === "project") {
        const p = await getProjectOr404(db, sid);
        return { projectId: p.projectId, teamId: p.teamId };
    }

    if (st === "resource") {
        const r = await db.collection("resources").findOne({ resourceId: sid });
        if (!r) throw notFound("Resource not found for secret scope", { scopeId: sid });
        const p = await getProjectOr404(db, r.projectId);
        return { projectId: p.projectId, teamId: p.teamId };
    }

    return null; // user scope can't be resolved to project/team
}

async function requireSecretMetaRead(db, { scopeType, scopeId }, actor) {
    if (actor.isSuperAdmin) return;

    const st = String(scopeType);
    const sid = String(scopeId);

    // schema doesn't allow "global", so reject explicitly
    if (st === "global") throw forbidden("Forbidden: global scope requires super_admin");

    if (st === "user") {
        if (sid !== String(actor.userId)) throw forbidden();
        return;
    }

    if (st === "team") {
        const b = await teamBindingExists(db, { teamId: sid, actorUserId: actor.userId, teamRoles: TEAM_READ });
        if (!b) throw forbidden();
        return;
    }

    if (st === "project" || st === "resource") {
        const resolved = await resolveSecretScopeToProject(db, st, sid);
        if (!resolved) throw badRequest("Unsupported scopeType", { scopeType: st });

        const b = await projectBindingExists(db, {
            projectId: resolved.projectId,
            teamId: resolved.teamId,
            actorUserId: actor.userId,
            projectRoles: PROJECT_READ,
            teamRoles: TEAM_READ
        });
        if (!b) throw forbidden();
        return;
    }

    throw badRequest("Unsupported scopeType", { scopeType: st });
}

async function requireSecretValueRead(db, { scopeType, scopeId }, actor) {
    if (actor.isSuperAdmin) return;

    const st = String(scopeType);
    const sid = String(scopeId);

    if (st === "global") throw forbidden("Forbidden: global scope requires super_admin");

    if (st === "user") {
        if (sid !== String(actor.userId)) throw forbidden();
        return;
    }

    if (st === "team") {
        const b = await teamBindingExists(db, { teamId: sid, actorUserId: actor.userId, teamRoles: TEAM_VALUE });
        if (!b) throw forbidden();
        return;
    }

    if (st === "project" || st === "resource") {
        const resolved = await resolveSecretScopeToProject(db, st, sid);
        if (!resolved) throw badRequest("Unsupported scopeType", { scopeType: st });

        const b = await projectBindingExists(db, {
            projectId: resolved.projectId,
            teamId: resolved.teamId,
            actorUserId: actor.userId,
            projectRoles: PROJECT_VALUE,
            teamRoles: TEAM_VALUE // team_owner can read values too
        });
        if (!b) throw forbidden();
        return;
    }

    throw badRequest("Unsupported scopeType", { scopeType: st });
}

export function secretsController(db) {
    const svc = secretsService(db);

    return {
        // GET /v1/secrets/:secretId?includeCiphertext=1
        get: async (req, res) => {
            const actor = actorFromReq(req);
            const secretId = String(req.params.secretId || "").trim();
            if (!secretId) throw badRequest("secretId required");

            // Fetch safe/meta first to enforce authz based on scope (no ciphertext)
            const meta = await svc.get(secretId, { includeCiphertext: false });

            await requireSecretMetaRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            const include = String(req.query.includeCiphertext || "") === "1";
            if (!include) {
                // meta already excludes ciphertext/encryptionMeta via repo/service
                return res.json({ secret: meta });
            }

            // value access is stricter than metadata
            await requireSecretValueRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            const full = await svc.get(secretId, { includeCiphertext: true });
            res.json({ secret: full });
        },

        // GET /v1/secrets?scopeType=resource&scopeId=res_xxx
        list: async (req, res) => {
            const actor = actorFromReq(req);

            const scopeType = String(req.query.scopeType || "").trim();
            const scopeId = String(req.query.scopeId || "").trim();
            if (!scopeType || !scopeId) throw badRequest("scopeType & scopeId required");

            await requireSecretMetaRead(db, { scopeType, scopeId }, actor);

            // repo already SAFE by default
            const rows = await svc.listByScope(scopeType, scopeId);
            res.json({ secrets: rows });
        }
    };
}
