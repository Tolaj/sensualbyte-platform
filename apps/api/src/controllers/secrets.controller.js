import { secretsService } from "../services/secrets.service.js";

export function secretsController(db) {
    const svc = secretsService(db);
    return {
        get: async (req, res) => {
            const s = await svc.get(req.params.secretId);
            const include = req.query.includeCiphertext === "1";
            if (!include) {
                const { ciphertext, encryptionMeta, ...safe } = s;
                return res.json({ secret: safe });
            }
            res.json({ secret: s });
        },
        list: async (req, res) => {
            const { scopeType, scopeId } = req.query;
            if (!scopeType || !scopeId) { const e = new Error("scopeType & scopeId required"); e.statusCode = 400; throw e; }
            const rows = await svc.listByScope(scopeType, scopeId);
            res.json({ secrets: rows.map(({ ciphertext, encryptionMeta, ...safe }) => safe) });
        }
    };
}
