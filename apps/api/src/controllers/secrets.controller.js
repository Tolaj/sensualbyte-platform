// apps/api/src/controllers/secrets.controller.js
import { secretsService } from "../services/secrets.service.js";
import { decryptString } from "../../../../packages/shared/crypto.js";

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}
function badRequest(message, details = null) { return httpError(400, message, details); }
function unauthorized(message = "Unauthorized", details = null) { return httpError(401, message, details); }
function forbidden(message = "Forbidden", details = null) { return httpError(403, message, details); }
function notFound(message = "Not found", details = null) { return httpError(404, message, details); }
function gone(message = "Gone", details = null) { return httpError(410, message, details); }

function actorFromReq(req) {
    const userId = typeof req.userId === "string" ? req.userId.trim() : "";
    if (!userId) throw unauthorized();
    return { userId, isSuperAdmin: req.isSuperAdmin === true };
}

// Your current schema allows only: project/resource/user
const TEAM_READ = ["team_owner", "team_member", "team_viewer"];
const TEAM_VALUE = ["team_owner"];

const PROJECT_READ = ["project_owner", "project_editor", "project_viewer"];
const PROJECT_VALUE = ["project_owner", "project_editor"];

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

    return null;
}

async function requireSecretMetaRead(db, { scopeType, scopeId }, actor) {
    if (actor.isSuperAdmin) return;

    const st = String(scopeType);
    const sid = String(scopeId);

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
            teamRoles: TEAM_VALUE
        });
        if (!b) throw forbidden();
        return;
    }

    throw badRequest("Unsupported scopeType", { scopeType: st });
}

function detectKeyFilename(privateKeyPem) {
    const s = String(privateKeyPem || "");
    if (s.includes("BEGIN RSA PRIVATE KEY")) return "id_rsa";
    if (s.includes("BEGIN OPENSSH PRIVATE KEY")) return "id_ed25519";
    if (s.includes("BEGIN PRIVATE KEY")) return "id_key";
    return "id_key";
}

export function secretsController(db) {
    const svc = secretsService(db);

    return {
        // GET /v1/secrets/:secretId?includeCiphertext=1
        get: async (req, res) => {
            const actor = actorFromReq(req);
            const secretId = String(req.params.secretId || "").trim();
            if (!secretId) throw badRequest("secretId required");

            const meta = await svc.get(secretId, { includeCiphertext: false });
            await requireSecretMetaRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            const include = String(req.query.includeCiphertext || "") === "1";
            if (!include) return res.json({ secret: meta });

            await requireSecretValueRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            // svc.get already blocks includeCiphertext if ssh_key was revealed
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

            const rows = await svc.listByScope(scopeType, scopeId);
            res.json({ secrets: rows });
        },

        // ✅ NEW: GET /v1/secrets/:secretId/ssh-key?download=1
        downloadSshKey: async (req, res) => {
            const actor = actorFromReq(req);

            const secretId = String(req.params.secretId || "").trim();
            if (!secretId) throw badRequest("secretId required");

            const download = String(req.query.download || "") === "1";
            if (!download) throw badRequest("use ?download=1");

            // meta first (authz based on scope)
            const meta = await svc.get(secretId, { includeCiphertext: false });
            await requireSecretMetaRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            if (meta.type !== "ssh_key") throw badRequest("secret is not ssh_key", { type: meta.type });

            // stricter access for value
            await requireSecretValueRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            if (meta.valueRevealed === true) {
                throw gone("SSH key already revealed", { secretId });
            }

            // Atomically claim. Only first caller gets the real ciphertext in returned doc.
            const claimed = await svc.claimSshKeyForDownload(secretId, actor.userId);

            if (!claimed) throw gone("SSH key already revealed", { secretId });

            // decrypt using the doc returned (it has original ciphertext + encryptionMeta)
            const plaintext = decryptString(claimed.ciphertext, claimed.encryptionMeta);
            const obj = JSON.parse(plaintext);

            const privateKeyPem = (String(obj.privateKeyPem || "").trim() + "\n");
            const filename = detectKeyFilename(privateKeyPem);

            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Cache-Control", "no-store");

            return res.status(200).send(privateKeyPem);
        }
    };
}
