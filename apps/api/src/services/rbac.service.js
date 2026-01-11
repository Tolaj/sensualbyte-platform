// apps/api/src/services/rbac.service.js
import { iamRolesRepo } from "../repos/iamRoles.repo.js";
import { iamBindingsRepo } from "../repos/iamBindings.repo.js";

function uniq(arr) {
    return Array.from(new Set(arr));
}

function normStr(v) {
    return String(v ?? "").trim();
}

async function expandRolePermissions(rolesRepo, roleId, ctx) {
    const rid = normStr(roleId);
    if (!rid) return [];

    // memoization
    if (ctx.memo.has(rid)) return ctx.memo.get(rid);

    // recursion/loop guards
    if (ctx.seen.has(rid)) return [];
    if (ctx.depth > ctx.maxDepth) return [];

    ctx.seen.add(rid);
    ctx.depth += 1;

    const role = await rolesRepo.get(rid);
    if (!role) {
        ctx.memo.set(rid, []);
        return [];
    }

    let perms = Array.isArray(role.permissions) ? role.permissions.map(normStr).filter(Boolean) : [];
    const inherits = Array.isArray(role.inherits) ? role.inherits.map(normStr).filter(Boolean) : [];

    for (const parentId of inherits) {
        const parentPerms = await expandRolePermissions(rolesRepo, parentId, ctx);
        perms = perms.concat(parentPerms);
    }

    perms = uniq(perms);

    ctx.memo.set(rid, perms);
    return perms;
}

function matchPermission(haveRaw, needRaw) {
    const have = normStr(haveRaw);
    const need = normStr(needRaw);
    if (!have || !need) return false;

    if (have === need) return true;
    if (have === "*") return true;

    // wildcard support: "project.*" matches "project.read"
    if (have.endsWith(".*")) {
        const prefix = have.slice(0, -2);
        return need.startsWith(prefix + ".");
    }

    return false;
}

export function rbacService(db) {
    const roles = iamRolesRepo(db);
    const bindings = iamBindingsRepo(db);

    return {
        /**
         * user = { userId, globalRole? }
         * scopesToCheck = [{scopeType, scopeId}, ...] ordered most specific -> least
         */
        async hasPermission({ user, permission, scopesToCheck }) {
            const userId = normStr(user?.userId);
            const need = normStr(permission);
            if (!userId || !need) return false;

            // super admin bypass
            if (user?.globalRole === "super_admin") return true;

            const scopes = Array.isArray(scopesToCheck) ? scopesToCheck : [];
            if (!scopes.length) return false;

            // pull all bindings for user (v1 OK)
            const b = await bindings.listForSubject("user", userId);
            if (!Array.isArray(b) || !b.length) return false;

            // match any binding that hits any scope in scopesToCheck
            const matching = b.filter((x) =>
                scopes.some(
                    (s) =>
                        normStr(s?.scopeType) === normStr(x?.scopeType) &&
                        normStr(s?.scopeId) === normStr(x?.scopeId)
                )
            );

            if (!matching.length) return false;

            // expand permissions with memoization (avoids repeated DB role reads)
            const ctx = {
                memo: new Map(),     // roleId -> perms[]
                seen: new Set(),     // for cycle detection during one expansion chain
                depth: 0,
                maxDepth: 25
            };

            let perms = [];
            for (const m of matching) {
                const roleId = normStr(m?.roleId);
                if (!roleId) continue;
                const p = await expandRolePermissions(roles, roleId, ctx);
                perms = perms.concat(p);
            }

            perms = uniq(perms);

            return perms.some((p) => matchPermission(p, need));
        }
    };
}
