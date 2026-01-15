// apps/api/src/middleware/auth.js
// v1: header auth. Added: JWT/session (backward compatible).
// Behavior preserved:
// - In production: x-user-id REQUIRED (unless Bearer token is provided)
// - In non-prod: x-user-id optional (falls back to user_demo) (unless Bearer token is provided)
// In all cases: user must exist + active, and roles come only from DB.

import jwt from "jsonwebtoken";

function isProd() {
    return (process.env.NODE_ENV || "development") === "production";
}

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}

function readHeaderString(req, name) {
    // Node/Express normalizes incoming header keys to lowercase in req.headers
    const v = req.headers[name];
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return "";
}

function validateUserId(userId) {
    const id = String(userId ?? "").trim();
    if (!id) return false;
    if (id.length > 120) return false;
    return /^[a-zA-Z0-9._-]+$/.test(id);
}

function readBearerToken(req) {
    const h = readHeaderString(req, "authorization").trim();
    if (!h) return "";
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1].trim() : "";
}

function getEnv(name, fallback = "") {
    const v = process.env[name];
    return (v == null ? fallback : String(v)).trim();
}

function getJwtVerifyOptions() {
    // Defaults to HS256 (jsonwebtoken default). We allow overriding algorithms explicitly.
    const alg = getEnv("JWT_ALG", "HS256");
    const issuer = getEnv("JWT_ISSUER", "");
    const audience = getEnv("JWT_AUDIENCE", "");

    const opts = {
        algorithms: [alg],
        // Keep small tolerance for clock drift (seconds)
        clockTolerance: 10,
    };

    if (issuer) opts.issuer = issuer;
    if (audience) opts.audience = audience;

    return opts;
}

function getJwtKeyOrSecret() {
    // Backward-compatible: JWT_SECRET is required for HS* algorithms.
    // Optional future-proof: allow asymmetric verification if configured.
    const alg = getEnv("JWT_ALG", "HS256").toUpperCase();

    if (alg.startsWith("RS") || alg.startsWith("ES")) {
        const pub = getEnv("JWT_PUBLIC_KEY", "");
        if (!pub) throw httpError(500, "Auth misconfigured: JWT_PUBLIC_KEY not set");
        return pub;
    }

    const secret = getEnv("JWT_SECRET", "");
    if (!secret) throw httpError(500, "Auth misconfigured: JWT_SECRET not set");
    return secret;
}

async function loadUserOrThrow(db, userId) {
    const user = await db.collection("users").findOne({ userId });

    if (!user) {
        // Avoid leaking identity information in production
        throw isProd()
            ? httpError(401, "Unauthorized")
            : httpError(401, "Unauthorized: unknown user", { userId });
    }

    if (user.active !== true) {
        throw isProd()
            ? httpError(403, "Forbidden")
            : httpError(403, "Forbidden: user disabled", { userId });
    }

    return user;
}

function attachReqUser(req, user, authMeta = {}) {
    req.userId = user.userId;

    req.user = {
        userId: user.userId,
        email: user.email,
        name: user.name ?? null,
        username: user.username ?? null,
        globalRole: user.globalRole,
    };

    req.globalRole = user.globalRole;
    req.isSuperAdmin = user.globalRole === "super_admin";

    // Handy for auditing/telemetry downstream (non-breaking addition)
    req.auth = {
        method: authMeta.method || "unknown",
        ...(authMeta.jti ? { jti: authMeta.jti } : {}),
        ...(authMeta.sub ? { sub: authMeta.sub } : {}),
    };
}

export function requireAuth() {
    return async (req, _res, next) => {
        try {
            const db = req.ctx?.db;
            if (!db) throw httpError(500, "Auth misconfigured: db not available in req.ctx");

            // 1) Prefer JWT if present
            const token = readBearerToken(req);
            if (token) {
                let payload;
                try {
                    const keyOrSecret = getJwtKeyOrSecret();
                    const opts = getJwtVerifyOptions();
                    payload = jwt.verify(token, keyOrSecret, opts);
                } catch (_e) {
                    // Keep response generic
                    throw httpError(401, "Unauthorized: invalid token");
                }

                if (!payload || typeof payload !== "object") {
                    throw httpError(401, "Unauthorized: invalid token payload");
                }

                const userId = String(payload.userId || "").trim();
                if (!userId) throw httpError(401, "Unauthorized: invalid token payload");
                if (!validateUserId(userId)) {
                    throw isProd()
                        ? httpError(401, "Unauthorized: invalid token payload")
                        : httpError(400, "Invalid userId in token", { userId });
                }

                const user = await loadUserOrThrow(db, userId);
                attachReqUser(req, user, {
                    method: "jwt",
                    jti: payload.jti ? String(payload.jti) : undefined,
                    sub: payload.sub ? String(payload.sub) : undefined,
                });

                return next();
            }

            // 2) Header auth (exact behavior preserved)
            const prod = isProd();
            const raw = readHeaderString(req, "x-user-id").trim();
            const userId = raw ? raw : prod ? "" : "user_demo";

            if (!userId) throw httpError(401, "Unauthorized: x-user-id header required");
            if (!validateUserId(userId)) {
                throw isProd()
                    ? httpError(401, "Unauthorized")
                    : httpError(400, "Invalid x-user-id header", { userId });
            }

            const user = await loadUserOrThrow(db, userId);
            attachReqUser(req, user, { method: "header" });

            return next();
        } catch (err) {
            return next(err);
        }
    };
}
