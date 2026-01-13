// apps/api/src/services/secrets.service.js
import { secretsRepo } from "../repos/secrets.repo.js";

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}
function notFound(message, details = null) { return httpError(404, message, details); }
function badRequest(message, details = null) { return httpError(400, message, details); }
function gone(message, details = null) { return httpError(410, message, details); }

function norm(v, field) {
    const s = String(v ?? "").trim();
    if (!s) throw badRequest(`${field} required`);
    return s;
}

export function secretsService(db) {
    const secrets = secretsRepo(db);

    return {
        async get(secretId, opts = {}) {
            const sid = norm(secretId, "secretId");
            const includeCiphertext = opts.includeCiphertext === true;

            const s = await secrets.get(sid, { includeCiphertext });

            if (!s) throw notFound("Secret not found", { secretId: sid });

            // hard block: once revealed, never allow ciphertext again
            if (includeCiphertext && s.type === "ssh_key" && s.valueRevealed === true) {
                throw gone("SSH key already revealed", { secretId: sid });
            }

            return s;
        },

        async listByScope(scopeType, scopeId) {
            const st = norm(scopeType, "scopeType");
            const sid = norm(scopeId, "scopeId");
            return secrets.listByScope(st, sid);
        },

        async claimSshKeyForDownload(secretId, revealedBy) {
            const sid = norm(secretId, "secretId");
            const actor = norm(revealedBy, "revealedBy");
            return secrets.claimSshKeyForDownload(sid, actor);
        }
    };
}
