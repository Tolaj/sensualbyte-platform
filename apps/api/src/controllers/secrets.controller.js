// apps/api/src/controllers/secrets.controller.js
import { secretsService } from "../services/secrets.service.js";
import { decryptString } from "../../../../packages/shared/crypto.js";
import { auditService } from "../services/audit.service.js";

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
function forbidden(message = "Forbidden", details = null) {
    return httpError(403, message, details);
}
function notFound(message = "Not found", details = null) {
    return httpError(404, message, details);
}
function gone(message = "Gone", details = null) {
    return httpError(410, message, details);
}

function safeDetails(details) {
    return isProd() ? null : details;
}

function normStr(v) {
    return String(v ?? "").trim();
}

function validateId(value, field) {
    const s = normStr(value);
    if (!s) throw badRequest(`${field} required`);
    if (s.length > 120) throw badRequest(`${field} too long`);
    if (!/^[a-zA-Z0-9._-]+$/.test(s)) throw badRequest(`Invalid ${field}`, safeDetails({ value: s }));
    return s;
}

function actorFromReq(req) {
    const userId = typeof req.userId === "string" ? req.userId.trim() : "";
    if (!userId) throw unauthorized();
    return { userId, isSuperAdmin: req.isSuperAdmin === true };
}

// Role policy (preserve existing semantics)
const TEAM_READ = ["team_owner", "team_member", "team_viewer"];
const TEAM_VALUE = ["team_owner"];

const PROJECT_READ = ["project_owner", "project_editor", "project_viewer"];
const PROJECT_VALUE = ["project_owner", "project_editor"];

async function getProjectOr404(db, projectId) {
    const pid = validateId(projectId, "projectId");
    const p = await db.collection("projects").findOne({ projectId: String(pid) });
    if (!p) throw notFound("Project not found", safeDetails({ projectId: pid }));
    return p;
}

async function projectBindingExists(db, { projectId, teamId, actorUserId, projectRoles, teamRoles }) {
    return db.collection("iam_bindings").findOne(
        {
            subjectType: "user",
            subjectId: String(actorUserId),
            $or: [
                { scopeType: "project", scopeId: String(projectId), roleId: { $in: projectRoles } },
                { scopeType: "team", scopeId: String(teamId), roleId: { $in: teamRoles } },
            ],
        },
        { projection: { _id: 1 } }
    );
}

async function teamBindingExists(db, { teamId, actorUserId, teamRoles }) {
    return db.collection("iam_bindings").findOne(
        {
            scopeType: "team",
            scopeId: String(teamId),
            subjectType: "user",
            subjectId: String(actorUserId),
            roleId: { $in: teamRoles },
        },
        { projection: { _id: 1 } }
    );
}

async function resolveSecretScopeToProject(db, scopeType, scopeId) {
    const st = normStr(scopeType);
    const sid = normStr(scopeId);

    if (st === "project") {
        const p = await getProjectOr404(db, sid);
        return { projectId: p.projectId, teamId: p.teamId };
    }

    if (st === "resource") {
        const rid = validateId(sid, "resourceId");
        const r = await db.collection("resources").findOne(
            { resourceId: rid },
            { projection: { _id: 0, resourceId: 1, projectId: 1 } }
        );
        if (!r) throw notFound("Resource not found for secret scope", safeDetails({ scopeId: rid }));
        const p = await getProjectOr404(db, r.projectId);
        return { projectId: p.projectId, teamId: p.teamId };
    }

    return null;
}

function validateScope(scopeType, scopeId) {
    const st = normStr(scopeType);
    const sid = normStr(scopeId);
    if (!st || !sid) throw badRequest("scopeType & scopeId required");

    const allowed = new Set(["user", "team", "project", "resource"]);
    if (!allowed.has(st)) throw badRequest("Unsupported scopeType", safeDetails({ scopeType: st }));

    // validate ids
    if (st === "user") validateId(sid, "userId");
    if (st === "team") validateId(sid, "teamId");
    if (st === "project") validateId(sid, "projectId");
    if (st === "resource") validateId(sid, "resourceId");

    return { scopeType: st, scopeId: sid };
}

async function requireSecretMetaRead(db, { scopeType, scopeId }, actor) {
    if (actor.isSuperAdmin) return;

    const { scopeType: st, scopeId: sid } = validateScope(scopeType, scopeId);

    if (st === "user") {
        if (sid !== String(actor.userId)) throw forbidden();
        return;
    }

    if (st === "team") {
        const b = await teamBindingExists(db, {
            teamId: sid,
            actorUserId: actor.userId,
            teamRoles: TEAM_READ,
        });
        if (!b) throw forbidden();
        return;
    }

    if (st === "project" || st === "resource") {
        const resolved = await resolveSecretScopeToProject(db, st, sid);
        if (!resolved) throw badRequest("Unsupported scopeType", safeDetails({ scopeType: st }));

        const b = await projectBindingExists(db, {
            projectId: resolved.projectId,
            teamId: resolved.teamId,
            actorUserId: actor.userId,
            projectRoles: PROJECT_READ,
            teamRoles: TEAM_READ,
        });

        if (!b) throw forbidden();
        return;
    }

    throw badRequest("Unsupported scopeType", safeDetails({ scopeType: st }));
}

async function requireSecretValueRead(db, { scopeType, scopeId }, actor) {
    if (actor.isSuperAdmin) return;

    const { scopeType: st, scopeId: sid } = validateScope(scopeType, scopeId);

    if (st === "user") {
        if (sid !== String(actor.userId)) throw forbidden();
        return;
    }

    if (st === "team") {
        const b = await teamBindingExists(db, {
            teamId: sid,
            actorUserId: actor.userId,
            teamRoles: TEAM_VALUE,
        });
        if (!b) throw forbidden();
        return;
    }

    if (st === "project" || st === "resource") {
        const resolved = await resolveSecretScopeToProject(db, st, sid);
        if (!resolved) throw badRequest("Unsupported scopeType", safeDetails({ scopeType: st }));

        const b = await projectBindingExists(db, {
            projectId: resolved.projectId,
            teamId: resolved.teamId,
            actorUserId: actor.userId,
            projectRoles: PROJECT_VALUE,
            teamRoles: TEAM_VALUE,
        });

        if (!b) throw forbidden();
        return;
    }

    throw badRequest("Unsupported scopeType", safeDetails({ scopeType: st }));
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
    const audit = auditService(db);

    return {
        // GET /v1/secrets/:secretId?includeCiphertext=1
        get: async (req, res) => {
            const actor = actorFromReq(req);
            const secretId = validateId(req.params.secretId, "secretId");

            const meta = await svc.get(secretId, { includeCiphertext: false });
            await requireSecretMetaRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            const include = String(req.query.includeCiphertext || "") === "1";
            if (!include) return res.json({ secret: meta });

            await requireSecretValueRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            // svc.get already blocks includeCiphertext if ssh_key was revealed
            const full = await svc.get(secretId, { includeCiphertext: true });

            await audit.log({
                actorUserId: actor.userId,
                action: "secret.read_value",
                resourceType: "secret",
                resourceId: secretId,
                metadata: { scopeType: meta.scopeType, scopeId: meta.scopeId },
            });

            return res.json({ secret: full });
        },

        /**
         * LIST:
         * Backward compatible:
         * - /v1/secrets?scopeType=project&scopeId=proj_xxx
         * Safer convenience:
         * - /v1/secrets?projectId=proj_xxx (maps to scopeType=project)
         */
        list: async (req, res) => {
            const actor = actorFromReq(req);

            const projectId = req.query.projectId ? normStr(req.query.projectId) : "";
            let scopeType = normStr(req.query.scopeType);
            let scopeId = normStr(req.query.scopeId);

            if (projectId) {
                scopeType = "project";
                scopeId = validateId(projectId, "projectId");
            }

            if (!scopeType || !scopeId) throw badRequest("scopeType & scopeId required (or projectId)");

            await requireSecretMetaRead(db, { scopeType, scopeId }, actor);

            const rows = await svc.listByScope(scopeType, scopeId);
            return res.json({ secrets: rows });
        },

        // ✅ NEW: GET /v1/secrets/:secretId/ssh-key?download=1
        downloadSshKey: async (req, res) => {
            const actor = actorFromReq(req);

            const secretId = validateId(req.params.secretId, "secretId");

            const download = String(req.query.download || "") === "1";
            if (!download) throw badRequest("use ?download=1");

            // meta first (authz based on scope)
            const meta = await svc.get(secretId, { includeCiphertext: false });
            await requireSecretMetaRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            if (meta.type !== "ssh_key") throw badRequest("secret is not ssh_key", safeDetails({ type: meta.type }));

            // stricter access for value
            await requireSecretValueRead(db, { scopeType: meta.scopeType, scopeId: meta.scopeId }, actor);

            if (meta.valueRevealed === true) {
                throw gone("SSH key already revealed", safeDetails({ secretId }));
            }

            // Atomically claim. Only first caller gets the real ciphertext in returned doc.
            const claimed = await svc.claimSshKeyForDownload(secretId, actor.userId);
            if (!claimed) throw gone("SSH key already revealed", safeDetails({ secretId }));

            // decrypt using the doc returned (it has original ciphertext + encryptionMeta)
            const plaintext = decryptString(claimed.ciphertext, claimed.encryptionMeta);
            const obj = JSON.parse(plaintext);

            const privateKeyPem = String(obj.privateKeyPem || "").trim() + "\n";
            const filename = detectKeyFilename(privateKeyPem);

            await audit.log({
                actorUserId: actor.userId,
                action: "secret.ssh_key.reveal",
                resourceType: "secret",
                resourceId: secretId,
                metadata: { scopeType: meta.scopeType, scopeId: meta.scopeId, filename },
            });

            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Cache-Control", "no-store");

            return res.status(200).send(privateKeyPem);
        },
    };
}
