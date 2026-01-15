import { rbacService } from "../services/rbac.service.js";

function bool(v, fallback = false) {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return fallback;
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function isProd() {
  return (process.env.NODE_ENV || "development") === "production";
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return null;

  const out = [];
  for (const s of scopes) {
    if (!s || typeof s !== "object") continue;
    const scopeType = String(s.scopeType ?? "").trim();
    const scopeId = String(s.scopeId ?? "").trim();
    if (!scopeType || !scopeId) continue;
    out.push({ scopeType, scopeId });
  }
  return out.length ? out : null;
}

function buildForbiddenError({ permission, scopes }) {
  const e = new Error("Forbidden");
  e.statusCode = 403;

  // Don't leak authorization topology in production responses.
  if (!isProd()) {
    e.details = { permission, scopes };
  }

  return e;
}

/**
 * requirePermission(permission, scopeResolver)
 * - permission: string, e.g. "project.read"
 * - scopeResolver(req) => [{scopeType, scopeId}, ...] (ordered)
 */
export function requirePermission(permission, scopeResolver) {
  if (!permission || typeof permission !== "string") {
    throw new Error("requirePermission(permission, scopeResolver) requires a non-empty permission string");
  }
  if (typeof scopeResolver !== "function") {
    throw new Error("requirePermission(permission, scopeResolver) requires a scopeResolver(req) function");
  }

  return async (req, _res, next) => {
    try {
      // Preferred flag: IAM_ENFORCE (defaults to true in production)
      // Back-compat: RBAC_ENFORCE (defaults false)
      const enforce =
        bool(process.env.IAM_ENFORCE, isProd()) ||
        bool(process.env.RBAC_ENFORCE, false);

      if (!enforce) return next();

      const db = req.ctx?.db;
      if (!db) {
        const e = new Error("IAM requires req.ctx.db");
        e.statusCode = 500;
        throw e;
      }

      // Auth middleware should set req.user and/or req.userId
      // - req.userId is used by header auth and JWT auth paths
      // - req.user is an object containing userId/globalRole for super_admin bypass logic in rbac.service.js
      const actorUserId = String(req.userId || req.user?.userId || "").trim();
      if (!actorUserId) {
        const e = new Error("Unauthorized");
        e.statusCode = 401;
        throw e;
      }

      const resolved = await Promise.resolve(scopeResolver(req));
      const scopes = normalizeScopes(resolved);
      if (!scopes) {
        const e = new Error("IAM scopeResolver must return a non-empty array of {scopeType, scopeId}");
        e.statusCode = 500;
        throw e;
      }

      // rbac.service.js exposes hasPermission({ user, permission, scopesToCheck })
      const userCtx = req.user || { userId: actorUserId, globalRole: req.globalRole };

      const ok = await rbacService(db).hasPermission({
        user: userCtx,
        permission,
        scopesToCheck: scopes,
      });

      if (!ok) throw buildForbiddenError({ permission, scopes });

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
