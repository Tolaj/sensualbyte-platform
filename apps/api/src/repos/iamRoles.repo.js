// apps/api/src/repos/iamRoles.repo.js
export function iamRolesRepo(db) {
    const col = db.collection("iam_roles");

    const SCOPE_TYPES = new Set(["global", "user", "team", "project", "resource", "secret"]);

    function httpError(statusCode, message, details = null) {
        const e = new Error(message);
        e.statusCode = statusCode;
        if (details) e.details = details;
        return e;
    }

    function normStr(v, field) {
        const s = String(v ?? "").trim();
        if (!s) throw httpError(400, `${field} is required`);
        return s;
    }

    function normOptionalStr(v) {
        const s = String(v ?? "").trim();
        return s ? s : null;
    }

    function normBool(v, field) {
        if (typeof v === "boolean") return v;
        // accept "true"/"false"/1/0
        const s = String(v ?? "").toLowerCase().trim();
        if (s === "true" || s === "1") return true;
        if (s === "false" || s === "0") return false;
        throw httpError(400, `${field} must be boolean`);
    }

    function normPermissions(v) {
        if (!Array.isArray(v)) throw httpError(400, "permissions must be an array of strings");
        const perms = v.map((x) => String(x ?? "").trim()).filter(Boolean);
        // allow ["*"] etc, but disallow empty list
        if (!perms.length) throw httpError(400, "permissions must not be empty");
        return perms;
    }

    function normInherits(v) {
        if (v === null || v === undefined) return null;
        if (!Array.isArray(v)) throw httpError(400, "inherits must be an array of roleIds or null");
        const ids = v.map((x) => String(x ?? "").trim()).filter(Boolean);
        return ids.length ? ids : null;
    }

    function normScopeType(v) {
        const s = normStr(v, "scopeType");
        if (!SCOPE_TYPES.has(s)) throw httpError(400, "Invalid scopeType", { scopeType: s });
        return s;
    }

    return {
        async get(roleId) {
            const rid = normStr(roleId, "roleId");
            return col.findOne({ roleId: rid });
        },

        async list({ scopeType } = {}) {
            const q = {};
            if (scopeType !== undefined && scopeType !== null && String(scopeType).trim()) {
                q.scopeType = normScopeType(scopeType);
            }
            return col.find(q).sort({ scopeType: 1, roleId: 1 }).toArray();
        },

        /**
         * Upsert semantics:
         * - roleId immutable key
         * - createdAt only on insert
         * - updatedAt set on every run
         * - validates required fields to fail fast (400) instead of Mongo/schema errors
         *
         * Note: For "system" roles, this allows idempotent updates (seed re-run),
         * but prevents changing roleId (always) and prevents changing scopeType/name
         * once a system role already exists (hardening).
         */
        async upsert(doc) {
            if (!doc || typeof doc !== "object") throw httpError(400, "doc must be an object");

            const roleId = normStr(doc.roleId, "roleId");
            const name = normStr(doc.name, "name");
            const scopeType = normScopeType(doc.scopeType);
            const permissions = normPermissions(doc.permissions);
            const description = doc.description === undefined ? undefined : normOptionalStr(doc.description);
            const inherits = doc.inherits === undefined ? undefined : normInherits(doc.inherits);
            const system = normBool(doc.system, "system");

            const now = new Date();

            // If system role already exists, prevent changing core identity fields.
            const existing = await col.findOne({ roleId }, { projection: { _id: 0, roleId: 1, name: 1, scopeType: 1, system: 1 } });
            if (existing?.system === true) {
                if (system !== true) throw httpError(400, "Cannot unset system role", { roleId });
                if (existing.name !== name) throw httpError(400, "Cannot change name of system role", { roleId });
                if (existing.scopeType !== scopeType) throw httpError(400, "Cannot change scopeType of system role", { roleId });
            }

            // Build $set safely (don’t accidentally write undefined)
            const set = {
                name,
                scopeType,
                permissions,
                system,
                updatedAt: now
            };
            if (description !== undefined) set.description = description;
            if (inherits !== undefined) set.inherits = inherits;

            const createdAt = doc.createdAt instanceof Date ? doc.createdAt : now;

            await col.updateOne(
                { roleId },
                {
                    $setOnInsert: { roleId, createdAt },
                    $set: set
                },
                { upsert: true }
            );

            return col.findOne({ roleId });
        }
    };
}
