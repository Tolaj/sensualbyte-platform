// apps/api/src/repos/iamRoles.repo.js
export function iamRolesRepo(db) {
    const col = db.collection("iam_roles");

    function httpError(statusCode, message, details = null) {
        const e = new Error(message);
        e.statusCode = statusCode;
        if (details) e.details = details;
        return e;
    }

    function normStr(v) {
        return String(v ?? "").trim();
    }

    function normRoleId(v) {
        const rid = normStr(v);
        if (!rid) throw httpError(400, "roleId required");
        if (rid.length > 120) throw httpError(400, "roleId too long", { roleId: rid });
        if (!/^[a-zA-Z0-9._-]+$/.test(rid)) throw httpError(400, "Invalid roleId", { roleId: rid });
        return rid;
    }

    return {
        async list({ scopeType } = {}) {
            const q = {};
            if (scopeType) q.scopeType = String(scopeType);
            return col.find(q).sort({ createdAt: 1 }).toArray();
        },

        async get(roleId) {
            const rid = normRoleId(roleId);
            return col.findOne({ roleId: rid });
        },

        async upsert(doc) {
            if (!doc || typeof doc !== "object") throw httpError(400, "doc must be an object");

            const roleId = normRoleId(doc.roleId);
            const now = new Date();

            const existing = await col.findOne({ roleId });

            if (existing?.system === true) {
                throw httpError(400, "Cannot modify system role", { roleId });
            }

            const set = {};
            const name = doc.name !== undefined ? String(doc.name) : undefined;
            const description = doc.description !== undefined ? doc.description : undefined;
            const scopeType = doc.scopeType !== undefined ? String(doc.scopeType) : undefined;
            const permissions = doc.permissions !== undefined ? doc.permissions : undefined;
            const inherits = doc.inherits !== undefined ? doc.inherits : undefined;
            const system = doc.system !== undefined ? Boolean(doc.system) : undefined;

            if (system === true) throw httpError(400, "Cannot set system=true via upsert", { roleId });

            if (name !== undefined) set.name = name;
            if (scopeType !== undefined) set.scopeType = scopeType;
            if (permissions !== undefined) set.permissions = permissions;
            if (system !== undefined) set.system = system;
            if (description !== undefined) set.description = description;
            if (inherits !== undefined) set.inherits = inherits;

            const createdAt = existing?.createdAt instanceof Date ? existing.createdAt : now;

            await col.updateOne(
                { roleId },
                {
                    $setOnInsert: { roleId, createdAt },
                    $set: set,
                },
                { upsert: true }
            );

            return col.findOne({ roleId });
        },

        async remove(roleId) {
            const rid = normRoleId(roleId);

            const existing = await col.findOne({ roleId: rid }, { projection: { _id: 0, roleId: 1, system: 1 } });
            if (!existing) return { ok: true, deletedCount: 0 };

            if (existing.system === true) {
                throw httpError(400, "Cannot delete system role", { roleId: rid });
            }

            // safety: disallow delete if in use
            const used = await db.collection("iam_bindings").countDocuments({ roleId: rid });
            if (used > 0) {
                throw httpError(409, "Cannot delete role: role is in use by bindings", { roleId: rid, bindings: used });
            }

            const out = await col.deleteOne({ roleId: rid });
            return { ok: true, deletedCount: out.deletedCount || 0 };
        }
    };
}
