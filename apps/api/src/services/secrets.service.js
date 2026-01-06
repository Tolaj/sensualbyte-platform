import { secretsRepo } from "../repos/secrets.repo.js";

function notFound(message, details = null) {
    const e = new Error(message);
    e.statusCode = 404;
    if (details) e.details = details;
    return e;
}

export function secretsService(db) {
    const secrets = secretsRepo(db);

    return {
        async get(secretId) {
            const s = await secrets.get(secretId);
            if (!s) throw notFound("Secret not found", { secretId });
            return s;
        },

        async listByScope(scopeType, scopeId) {
            return secrets.listByScope(scopeType, scopeId);
        }
    };
}
