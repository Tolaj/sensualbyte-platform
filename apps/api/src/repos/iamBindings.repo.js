// apps/api/src/repos/iamBindings.repo.js
export function iamBindingsRepo(db) {
    const col = db.collection("iam_bindings");

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

    function normOptional(v) {
        const s = String(v ?? "").trim();
        return s || null;
    }

    function normDoc(doc) {
        if (!doc || typeof doc !== "object") throw httpError(400, "doc must be an object");

        const scopeType = norm(doc.scopeType, "scopeType");
        const scopeId = norm(doc.scopeId, "scopeId");
        const subjectType = norm(doc.subjectType, "subjectType");
        const subjectId = norm(doc.subjectId, "subjectId");
        const roleId = norm(doc.roleId, "roleId");

        return {
            ...doc,
            scopeType,
            scopeId,
            subjectType,
            subjectId,
            roleId,
            bindingId: normOptional(doc.bindingId),
            createdBy: normOptional(doc.createdBy)
        };
    }

    return {
        async listForSubject(subjectType, subjectId) {
            const st = norm(subjectType, "subjectType");
            const sid = norm(subjectId, "subjectId");
            return col
                .find({ subjectType: st, subjectId: sid })
                .sort({ createdAt: -1 })
                .toArray();
        },

        async listForScope(scopeType, scopeId) {
            const st = norm(scopeType, "scopeType");
            const sid = norm(scopeId, "scopeId");
            return col
                .find({ scopeType: st, scopeId: sid })
                .sort({ createdAt: -1 })
                .toArray();
        },

        /**
         * Upsert semantics:
         * - ONE binding per (scopeType, scopeId, subjectType, subjectId)
         * - roleId is mutable (changing role updates the same binding)
         * - bindingId/createdAt/createdBy set only on insert
         *
         * IMPORTANT: bindingId is REQUIRED for inserts (schema requires it).
         */
        async upsert(doc) {
            const d = normDoc(doc);
            const now = new Date();

            // Because upsert can INSERT, we must guarantee bindingId exists.
            if (!d.bindingId) {
                throw httpError(400, "bindingId is required for upsert (used on insert)");
            }

            const filter = {
                scopeType: d.scopeType,
                scopeId: d.scopeId,
                subjectType: d.subjectType,
                subjectId: d.subjectId
            };

            const update = {
                $setOnInsert: {
                    bindingId: d.bindingId,
                    createdAt: d.createdAt instanceof Date ? d.createdAt : now,
                    createdBy: d.createdBy ?? null,
                    scopeType: d.scopeType,
                    scopeId: d.scopeId,
                    subjectType: d.subjectType,
                    subjectId: d.subjectId
                },
                $set: {
                    roleId: d.roleId,
                    updatedAt: now,
                    updatedBy: d.createdBy ?? null
                }
            };

            const r = await col.findOneAndUpdate(filter, update, {
                upsert: true,
                returnDocument: "after"
            });

            return r.value; // null only if something is very wrong
        },

        /**
         * Remove semantics:
         * - If roleId is provided, delete ONLY if it matches the current binding roleId.
         * - If roleId is omitted, delete the binding for that scope+subject regardless of role.
         */
        async removeOne({ scopeType, scopeId, subjectType, subjectId, roleId }) {
            const st = norm(scopeType, "scopeType");
            const sid = norm(scopeId, "scopeId");
            const sst = norm(subjectType, "subjectType");
            const ssid = norm(subjectId, "subjectId");

            const q = { scopeType: st, scopeId: sid, subjectType: sst, subjectId: ssid };

            if (roleId !== undefined && roleId !== null && String(roleId).trim()) {
                q.roleId = String(roleId).trim();
            }

            const r = await col.deleteOne(q);
            return { removed: r.deletedCount === 1 };
        }
    };
}
