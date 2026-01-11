// apps/api/src/middleware/rbac.js
function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}

function boolEnv(name, fallback = false) {
    const v = process.env[name];
    if (v === undefined || v === null || v === "") return fallback;
    const s = String(v).toLowerCase();
    return s === "true" || s === "1" || s === "yes";
}

function matchesPermission(granted, required) {
    if (!granted) return false;
    if (granted === "*") return true;
    if (granted === required) return true;

    // prefix wildcard, e.g. "project.*" matches "project.read"
    if (granted.endsWith(".*")) {
        const prefix = granted.slice(0, -2);
        return required === prefix || required.startsWith(prefix + ".");
    }

    return false;
}

async function expandRolePermissions({ rolesCol, roleId, cache, visiting }) {
    if (cache.has(roleId)) return cache.get(roleId);

    if (visiting.has(roleId)) {
        // cycle protection
        return new Set();
    }
    visiting.add(roleId);

    const role = await rolesCol.findOne({ roleId });
    if (!role) {
        cache.set(roleId, new Set());
        visiting.delete(roleId);
        return cache.get(roleId);
    }

    const perms = new Set(Array.isArray(role.permissions) ? role.permissions : []);

    const inherits = Array.isArray(role.inherits) ? role.inherits : [];
    for (const parentId of inherits) {
        const parentPerms = await expandRolePermissions({
            rolesCol,
            roleId: parentId,
            cache,
            visiting
        });
        for (const p of parentPerms) perms.add(p);
    }

    cache.set(roleId, perms);
    visiting.delete(roleId);
    return perms;
}

/**
 * Keeps your old API: requireProjectRole("viewer" | "editor" | "owner")
 * But underneath uses IAM permissions instead of role_bindings.
 *
 * Mapping:
 * - viewer -> project.read
 * - editor -> project.read + resource.update (practical)
 * - owner  -> project.*   (full control)
 */
export function requireProjectRole(minRole = "viewer") {
    const roleToRequiredPerms = {
        viewer: ["project.read"],
        editor: ["project.read", "resource.update"],
        owner: ["project.*"]
    };

    const required = roleToRequiredPerms[minRole];
    if (!required) throw new Error(`requireProjectRole: unknown minRole=${minRole}`);

    return async (req, _res, next) => {
        try {
            const nodeEnv = process.env.NODE_ENV || "development";
            const enforce = boolEnv("IAM_ENFORCE", nodeEnv === "production") || boolEnv("RBAC_ENFORCE", false);

            if (!enforce) return next();

            if (req.isSuperAdmin) {
                req.iam = { bypass: "super_admin" };
                return next();
            }

            const db = req.ctx?.db;
            if (!db) throw httpError(500, "IAM misconfigured: db not available in req.ctx");

            const projectId = String(req.params.projectId || req.query.projectId || "");
            if (!projectId) throw httpError(400, "projectId is required for IAM check");

            const userId = req.userId;
            if (!userId) throw httpError(401, "Unauthorized");

            const projectsCol = db.collection("projects");
            const bindingsCol = db.collection("iam_bindings");
            const rolesCol = db.collection("iam_roles");

            const project = await projectsCol.findOne({ projectId });
            if (!project) throw httpError(404, "Project not found", { projectId });

            const teamId = project.teamId ? String(project.teamId) : null;

            // Pull all relevant bindings for this user
            // 1) global
            // 2) project-specific
            // 3) team-level (if project belongs to a team)
            const bindingQuery = {
                subjectType: "user",
                subjectId: userId,
                $or: [
                    { scopeType: "global", scopeId: "global" },
                    { scopeType: "project", scopeId: projectId }
                ]
            };
            if (teamId) {
                bindingQuery.$or.push({ scopeType: "team", scopeId: teamId });
            }

            const bindings = await bindingsCol.find(bindingQuery).toArray();

            // Expand permissions from roles
            const roleCache = new Map(); // roleId -> Set(perms)
            const visiting = new Set();

            const effectivePerms = new Set();
            for (const b of bindings) {
                const perms = await expandRolePermissions({
                    rolesCol,
                    roleId: b.roleId,
                    cache: roleCache,
                    visiting
                });
                for (const p of perms) effectivePerms.add(p);
            }

            const hasAll = required.every((reqPerm) => {
                // reqPerm can also be "project.*" (owner mapping)
                for (const granted of effectivePerms) {
                    if (matchesPermission(granted, reqPerm)) return true;
                    // Also allow reqPerm wildcard itself
                    if (reqPerm.endsWith(".*") && matchesPermission(granted, reqPerm.slice(0, -2) + ".read")) {
                        // (optional) not needed; keeping strict
                    }
                }
                return false;
            });

            if (!hasAll) {
                throw httpError(403, "Forbidden", {
                    projectId,
                    required,
                    bindings: bindings.map((b) => ({ scopeType: b.scopeType, scopeId: b.scopeId, roleId: b.roleId }))
                });
            }

            req.iam = {
                projectId,
                teamId,
                permissions: Array.from(effectivePerms)
            };

            next();
        } catch (err) {
            next(err);
        }
    };
}
