const ORDER = { viewer: 1, editor: 2, owner: 3 };

function bool(v, fallback = false) {
    const s = String(v ?? "").toLowerCase();
    if (!s) return fallback;
    return s === "true" || s === "1" || s === "yes";
}

export function requireProjectRole(minRole = "viewer") {
    if (!ORDER[minRole]) {
        throw new Error(`requireProjectRole: unknown minRole=${minRole}`);
    }

    return async (req, _res, next) => {
        try {
            const enforce = bool(process.env.RBAC_ENFORCE, false);
            if (!enforce) return next(); // v1 default: permissive

            const projectId = String(req.params.projectId || req.query.projectId || "");
            if (!projectId) {
                const e = new Error("projectId is required for RBAC check");
                e.statusCode = 400;
                throw e;
            }

            const userId = req.userId || "user_demo";
            const col = req.ctx?.db?.collection("role_bindings");
            if (!col) {
                const e = new Error("RBAC misconfigured: db not available in req.ctx");
                e.statusCode = 500;
                throw e;
            }

            const binding = await col.findOne({
                resourceType: "project",
                resourceId: projectId,
                subjectType: "user",
                subjectId: userId
            });

            const role = binding?.role || null;

            if (!role || !ORDER[role] || ORDER[role] < ORDER[minRole]) {
                const e = new Error("Forbidden");
                e.statusCode = 403;
                e.details = { projectId, required: minRole, role };
                throw e;
            }

            req.rbac = { role };
            next();
        } catch (err) {
            next(err);
        }
    };
}
