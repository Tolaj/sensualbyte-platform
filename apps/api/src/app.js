import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/error.js";

import { authRoutes } from "./routes/auth.routes.js";
import { identityRoutes } from "./routes/identity.routes.js";
import { projectsRoutes } from "./routes/projects.routes.js";
import { catalogRoutes } from "./routes/catalog.routes.js";
import { resourcesRoutes } from "./routes/resources.routes.js";
import { secretsRoutes } from "./routes/secrets.routes.js";
import { observabilityRoutes } from "./routes/observability.routes.js";

function parseOrigins() {
    const raw = process.env.CORS_ORIGINS;
    if (!raw) return null;
    const list = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return list.length ? list : null;
}

function corsMiddleware() {
    const origins = parseOrigins();
    const nodeEnv = process.env.NODE_ENV || "development";

    // v1 dev-friendly default: allow all
    if (!origins && nodeEnv !== "production") {
        return cors({ origin: true, credentials: true });
    }

    // production-safe: allow only configured origins
    if (!origins && nodeEnv === "production") {
        // safest: deny by default if not configured
        return cors({ origin: false });
    }

    return cors({
        origin: (origin, cb) => {
            // allow non-browser clients (no Origin header)
            if (!origin) return cb(null, true);
            if (origins.includes(origin)) return cb(null, true);
            return cb(new Error("CORS: origin not allowed"), false);
        },
        credentials: true
    });
}

export function createApp({ db, redis }) {
    if (!db) throw new Error("createApp: db is required");

    const app = express();

    app.disable("x-powered-by");

    // If you run behind a reverse proxy later (nginx/traefik), enable this:
    // app.set("trust proxy", 1);

    app.use(helmet());
    app.use(corsMiddleware());

    app.use(express.json({ limit: "1mb" }));
    app.use(requestId());

    app.use(
        morgan((tokens, req, res) => {
            const rid = req.requestId || "-";
            return [
                tokens.method(req, res),
                tokens.url(req, res),
                tokens.status(req, res),
                tokens["response-time"](req, res),
                "ms",
                "rid=" + rid
            ].join(" ");
        })
    );

    // attach context per request
    app.use((req, _res, next) => {
        req.ctx = { db, redis };
        next();
    });

    if (String(process.env.TRUST_PROXY || "") === "true") {
        app.set("trust proxy", 1);
    }


    app.get("/healthz", (_req, res) => res.json({ ok: true }));

    app.use("/v1/auth", authRoutes());
    app.use("/v1/identity", identityRoutes());
    app.use("/v1/projects", projectsRoutes());
    app.use("/v1/catalog", catalogRoutes());
    app.use("/v1/resources", resourcesRoutes());
    app.use("/v1/secrets", secretsRoutes());
    app.use("/v1/observability", observabilityRoutes());

    app.use(errorHandler());
    return app;
}
