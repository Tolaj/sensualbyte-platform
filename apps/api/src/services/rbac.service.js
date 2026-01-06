import { usersRepo } from "../repos/users.repo.js";
import { roleBindingsRepo } from "../repos/roleBindings.repo.js";
import { teamMembersRepo } from "../repos/teamMembers.repo.js";

const RANK = { viewer: 1, member: 1, admin: 2, owner: 3 };

function maxRole(a, b) {
    if (!a) return b;
    if (!b) return a;
    return RANK[a] >= RANK[b] ? a : b;
}

export function rbacService(db) {
    const users = usersRepo(db);
    const bindings = roleBindingsRepo(db);
    const teamMembers = teamMembersRepo(db);

    async function globalAllows(userId) {
        const u = await users.getByUserId(userId);
        if (!u) return false;
        return u.globalRole === "super_admin" || u.globalRole === "platform_admin";
    }

    async function effectiveRoleForResource({ userId, resourceType, resourceId }) {
        // direct bindings for user
        const direct = await bindings.listForSubject("user", userId);
        let best = null;
        for (const b of direct) {
            if (b.resourceType === resourceType && b.resourceId === resourceId) best = maxRole(best, b.role);
        }

        // team bindings
        const teamIds = await teamMembers.listTeamsForUser(userId);
        if (teamIds.length > 0) {
            for (const teamId of teamIds) {
                const teamBindings = await bindings.listForSubject("team", teamId);
                for (const b of teamBindings) {
                    if (b.resourceType === resourceType && b.resourceId === resourceId) best = maxRole(best, b.role);
                }
            }
        }
        return best;
    }

    function assertMinRole(have, need) {
        if (!have) return false;
        return (RANK[have] || 0) >= (RANK[need] || 0);
    }

    return {
        async requireResourceRole({ userId, resourceType, resourceId, minRole }) {
            if (await globalAllows(userId)) return true;

            const role = await effectiveRoleForResource({ userId, resourceType, resourceId });
            if (!assertMinRole(role, minRole)) {
                const e = new Error("Forbidden");
                e.statusCode = 403;
                e.details = { resourceType, resourceId, required: minRole, have: role || null };
                throw e;
            }
            return true;
        }
    };
}
