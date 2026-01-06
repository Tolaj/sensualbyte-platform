import { secretsService } from "../services/secrets.service.js";

function badRequest(message, details = null) {
    const e = new Error(message);
    e.statusCode = 400;
    if (details) e.details = details;
    return e;
}

export function secretsController(db) {
    const svc = secretsService(db);

    return {
        get: async (req, res) => {
            const secretId = String(req.params.secretId);
            const s = await svc.get(secretId);

            const include = String(req.query.includeCiphertext || "") === "1";
            if (!include) {
                const { ciphertext, encryptionMeta, ...safe } = s;
                return res.json({ secret: safe });
            }
            res.json({ secret: s });
        },

        list: async (req, res) => {
            const scopeType = String(req.query.scopeType || "");
            const scopeId = String(req.query.scopeId || "");
            if (!scopeType || !scopeId) throw badRequest("scopeType & scopeId required");

            const rows = await svc.listByScope(scopeType, scopeId);
            res.json({
                secrets: rows.map(({ ciphertext, encryptionMeta, ...safe }) => safe)
            });
        }
    };
}
