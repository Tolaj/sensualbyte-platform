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

    const CLEARED_CIPHERTEXT = "__CLEARED_AFTER_REVEAL__";

    return {
        // Immutable write
        async create(doc) {
            if (!doc || typeof doc !== "object") {
                throw httpError(400, "doc must be an object");
            }

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
                createdAt,

                // defaults for one-time reveal
                valueRevealed: doc.valueRevealed === true ? true : false
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
        },

        /**
         * One-time reveal claim for ssh_key.
         * - Returns the PREVIOUS doc (with ciphertext) if claim succeeded
         * - Returns null if already revealed / not ssh_key / not found
         */
        async claimSshKeyForDownload(secretId, revealedBy) {
            const id = norm(secretId, "secretId");
            const actor = norm(revealedBy, "revealedBy");
            const now = new Date();

            const res = await col.findOneAndUpdate(
                {
                    secretId: id,
                    type: "ssh_key",
                    valueRevealed: { $ne: true },
                    ciphertext: { $ne: CLEARED_CIPHERTEXT }
                },
                {
                    $set: {
                        valueRevealed: true,
                        revealedAt: now,
                        revealedBy: actor,

                        // keep schema valid, but remove useful ciphertext going forward
                        ciphertext: CLEARED_CIPHERTEXT
                    }
                },
                { returnDocument: "before" }
            );

            // Mongo returns { value, ok, lastErrorObject }. We want the previous document.
            return res?.value || null;
        },

        CLEARED_CIPHERTEXT
    };
}
