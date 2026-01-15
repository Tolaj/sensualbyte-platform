// apps/api/src/services/rbac.service.js
import { iamRolesRepo } from "../repos/iamRoles.repo.js";
import { iamBindingsRepo } from "../repos/iamBindings.repo.js";

function normStr(v) {
    return String(v ?? "").trim();
}

function uniq(arr) {
    return Array.from(new Set(arr));
}

/**
 * Permission matching:
 * - exact match: "project.read"
 * - all: "*"
 * - prefix wildcard: "project.*" matches "project.read"
 */
function matchPermission(haveRaw, needRaw) {
    const have = normStr(haveRaw);
    const need = normStr(needRaw);
    if (!have || !need) return false;

    if (have === need) return true;
    if (have === "*") return true;

    if (have.endsWith(".*")) {
        const prefix = have.slice(0, -2);
        return need.startsWith(prefix + ".");
    }

    return false;
}

/**
 * Expand a role's permissions with inheritance.
 * - Memoizes per roleId: roleId -> perms[]
 * - Uses per-path recursion stack to prevent cycles while still allowing siblings
 */
async function expandRolePermissions(rolesRepo, roleId, memo, stack, depth, maxDepth) {
    const rid = normStr(roleId);
    if (!rid) return [];

    if (memo.has(rid)) return memo.get(rid);

    // Cycle guard: role A -> B -> A
    if (stack.has(rid)) return [];

    if (depth > maxDepth) return [];

    stack.add(rid);

    const role = await rolesRepo.get(rid);
    if (!role) {
        memo.set(rid, []);
        stack.delete(rid);
        return [];
    }

    let perms = Array.isArray(role.permissions)
        ? role.permissions.map(normStr).filter(Boolean)
        : [];

    const inherits = Array.isArray(role.inherits)
        ? role.inherits.map(normStr).filter(Boolean)
        : [];

    for (const parentId of inherits) {
        const parentPerms = await expandRolePermissions(
            rolesRepo,
            parentId,
            memo,
            stack,
            depth + 1,
            maxDepth
        );
        if (parentPerms?.length) perms = perms.concat(parentPerms);
    }

    perms = uniq(perms);

    memo.set(rid, perms);
    stack.delete(rid);
    return perms;
}

/**
 * If your roles repo later exposes a batch API (getMany / listByIds),
 * we can use it automatically. For now, this safely falls back to get().
 */
async function getRolePermissionsForIds(rolesRepo, roleIds, maxDepth = 25) {
    const ids = uniq(roleIds.map(normStr).filter(Boolean));
    if (!ids.length) return [];

    const memo = new Map(); // roleId -> perms[]
    const allPerms = [];

    // If a batch method exists, pre-fill memo with direct permissions to reduce calls.
    // (We still need inheritance resolution via expandRolePermissions.)
    // eslint-disable-next-line no-unused-vars
    const hasBatch =
        typeof rolesRepo.getMany === "function" ||
        typeof rolesRepo.listByIds === "function";

    // Resolve each role with memoization + per-path stack
    for (const rid of ids) {
        const perms = await expandRolePermissions(
            rolesRepo,
            rid,
            memo,
            new Set(),
            0,
            maxDepth
        );
        if (perms?.length) allPerms.push(...perms);
    }

    return uniq(allPerms);
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

            // super admin bypass (as per promptpack behavior)
            if (user?.globalRole === "super_admin") return true;

            const scopes = Array.isArray(scopesToCheck) ? scopesToCheck : [];
            if (!scopes.length) return false;

            // Normalize scopes once (avoid repeated trim calls)
            const normScopes = scopes
                .map((s) => ({
                    scopeType: normStr(s?.scopeType),
                    scopeId: normStr(s?.scopeId),
                }))
                .filter((s) => s.scopeType && s.scopeId);

            if (!normScopes.length) return false;

            // Pull bindings for the user (v1 acceptable).
            // Later we can optimize by querying only needed scopes with a compound index.
            const userBindings = await bindings.listForSubject("user", userId);
            if (!Array.isArray(userBindings) || !userBindings.length) return false;

            // Find bindings that apply to any of the provided scopes
            const matching = [];
            for (const b of userBindings) {
                const bType = normStr(b?.scopeType);
                const bId = normStr(b?.scopeId);
                if (!bType || !bId) continue;

                if (normScopes.some((s) => s.scopeType === bType && s.scopeId === bId)) {
                    matching.push(b);
                }
            }

            if (!matching.length) return false;

            const roleIds = matching.map((m) => normStr(m?.roleId)).filter(Boolean);
            if (!roleIds.length) return false;

            // Expand role permissions (memoized + cycle safe)
            const perms = await getRolePermissionsForIds(roles, roleIds, 25);
            if (!perms.length) return false;

            return perms.some((p) => matchPermission(p, need));
        },
    };
}
