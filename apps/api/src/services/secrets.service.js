import { secretsRepo } from "../repos/secrets.repo.js";
export function secretsService(db) {
    const repo = secretsRepo(db);
    return {
        get: async (secretId) => {
            const s = await repo.get(secretId);
            if (!s) { const e = new Error(`Secret not found: ${secretId}`); e.statusCode = 404; throw e; }
            // v1: do not return ciphertext by default; require explicit query ?includeCiphertext=1
            return s;
        },
        listByScope: (scopeType, scopeId) => repo.listByScope(scopeType, scopeId)
    };
}
