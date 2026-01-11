// apps/api/src/middleware/auth.js
// v1: header auth. Later: JWT/session.
// Production-safe behavior:
// - In production: x-user-id REQUIRED, and user must exist + be active
// - In non-prod: x-user-id optional (falls back to user_demo), but still must exist + be active

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}

function readHeaderString(req, name) {
    const v = req.headers[name];
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return "";
}

function validateUserId(userId) {
    // adjust pattern if you use different ids; this matches: user_demo, user_xxx, etc.
    if (userId.length > 120) return false;
    return /^[a-zA-Z0-9._-]+$/.test(userId);
}

export function requireAuth() {
    return async (req, _res, next) => {
        try {
            const nodeEnv = process.env.NODE_ENV || "development";
            const isProd = nodeEnv === "production";

            const raw = readHeaderString(req, "x-user-id").trim();
            const userId = raw ? raw : (isProd ? "" : "user_demo");

            if (!userId) {
                throw httpError(401, "Unauthorized: x-user-id header required");
            }
            if (!validateUserId(userId)) {
                throw httpError(400, "Invalid x-user-id header", { userId });
            }

            const db = req.ctx?.db;
            if (!db) {
                throw httpError(500, "Auth misconfigured: db not available in req.ctx");
            }

            const user = await db.collection("users").findOne({ userId });
            if (!user) {
                throw httpError(401, "Unauthorized: unknown user", { userId });
            }
            if (user.active !== true) {
                throw httpError(403, "Forbidden: user disabled", { userId });
            }

            // IMPORTANT: Do not trust role headers. Role comes only from DB.
            req.userId = user.userId;
            req.user = {
                userId: user.userId,
                email: user.email,
                name: user.name ?? null,
                username: user.username ?? null,
                globalRole: user.globalRole
            };

            req.globalRole = user.globalRole;
            req.isSuperAdmin = user.globalRole === "super_admin";

            next();
        } catch (err) {
            next(err);
        }
    };
}
