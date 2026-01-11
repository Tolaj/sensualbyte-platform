// apps/api/src/repos/secrets.repo.js
export function secretsRepo(db) {
    const col = db.collection("secrets");

    function httpError(statusCode, message, details = null) {
        const e = new Error(message);
        e.statusCode = statusCode;
        if (details) e.details = details;
        return e;
    }

    function norm(v, field) {
        const s = String(v ?? "").trim();
        if (!s) throw httpError(400, `${field} is required`);
        return s;
    }

    function scope(scopeType, scopeId) {
        return {
            scopeType: norm(scopeType, "scopeType"),
            scopeId: norm(scopeId, "scopeId")
        };
    }

    // By default: do NOT return ciphertext/encryptionMeta (avoid accidental leakage)
    const SAFE_PROJECTION = {
        ciphertext: 0,
        encryptionMeta: 0
    };

    return {
        // Immutable write
        async create(doc) {
            if (!doc || typeof doc !== "object") {
                throw httpError(400, "doc must be an object");
            }

            // Normalize key fields used in queries/indexes
            const secretId = norm(doc.secretId, "secretId");
            const storeId = norm(doc.storeId, "storeId");
            const st = norm(doc.scopeType, "scopeType");
            const sid = norm(doc.scopeId, "scopeId");
            const name = norm(doc.name, "name");
            const type = norm(doc.type, "type");
            const createdBy = norm(doc.createdBy, "createdBy");

            const ciphertext = norm(doc.ciphertext, "ciphertext");
            const encryptionMeta = doc.encryptionMeta;
            if (!encryptionMeta || typeof encryptionMeta !== "object" || Array.isArray(encryptionMeta)) {
                throw httpError(400, "encryptionMeta must be an object");
            }

            const createdAt = doc.createdAt instanceof Date ? doc.createdAt : new Date();

            const toInsert = {
                ...doc,
                secretId,
                storeId,
                scopeType: st,
                scopeId: sid,
                name,
                type,
                ciphertext,
                encryptionMeta,
                createdBy,
                createdAt
            };

            await col.insertOne(toInsert);
            return toInsert;
        },

        // Safe read (no ciphertext by default)
        async get(secretId, { includeCiphertext = false } = {}) {
            const id = norm(secretId, "secretId");
            return col.findOne(
                { secretId: id },
                { projection: includeCiphertext ? undefined : SAFE_PROJECTION }
            );
        },

        // Safe list (no ciphertext)
        async listByScope(scopeType, scopeId) {
            const q = scope(scopeType, scopeId);
            return col
                .find(q, { projection: SAFE_PROJECTION })
                .sort({ createdAt: -1 })
                .toArray();
        },

        // Useful for “db/password” style lookups (safe by default)
        async getByScopeName(scopeType, scopeId, name, { includeCiphertext = false } = {}) {
            const q = { ...scope(scopeType, scopeId), name: norm(name, "name") };
            return col.findOne(
                q,
                { projection: includeCiphertext ? undefined : SAFE_PROJECTION }
            );
        },

        async deleteOne(secretId) {
            const id = norm(secretId, "secretId");
            const r = await col.deleteOne({ secretId: id });
            return { deleted: r.deletedCount === 1 };
        }
    };
}
