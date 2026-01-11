import { rbacService } from "../services/rbac.service.js";

function bool(v, fallback = false) {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return fallback;
  return s === "true" || s === "1" || s === "yes";
}

/**
 * requirePermission(permission, scopeResolver)
 * - permission: string, e.g. "project.read"
 * - scopeResolver(req) => [{scopeType, scopeId}, ...] (ordered)
 */
export function requirePermission(permission, scopeResolver) {
  return async (req, _res, next) => {
    try {
      // New flag: IAM_ENFORCE (preferred)
      // Back-compat: RBAC_ENFORCE
      const enforce =
        bool(process.env.IAM_ENFORCE, (process.env.NODE_ENV || "development") === "production") ||
        bool(process.env.RBAC_ENFORCE, false);

      if (!enforce) return next();

      const db = req.ctx?.db;
      if (!db) {
        const e = new Error("IAM requires req.ctx.db");
        e.statusCode = 500;
        throw e;
      }

      const actorUserId = req.userId;
      if (!actorUserId) {
        const e = new Error("Unauthorized");
        e.statusCode = 401;
        throw e;
      }

      const scopes = await Promise.resolve(scopeResolver(req));
      if (!Array.isArray(scopes) || !scopes.length) {
        const e = new Error("IAM scopeResolver must return a non-empty array");
        e.statusCode = 500;
        throw e;
      }

      const ok = await rbacService(db).isAllowed(actorUserId, permission, scopes);
      if (!ok) {
        const e = new Error("Forbidden");
        e.statusCode = 403;
        e.details = { permission, scopes };
        throw e;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
