import express from "express";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/error.js";

import { authRoutes } from "./routes/auth.routes.js";
import { identityRoutes } from "./routes/identity.routes.js";
import { projectsRoutes } from "./routes/projects.routes.js";
import { catalogRoutes } from "./routes/catalog.routes.js";
import { resourcesRoutes } from "./routes/resources.routes.js";
import { secretsRoutes } from "./routes/secrets.routes.js";
import { observabilityRoutes } from "./routes/observability.routes.js";

export function createApp({ db }) {
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use(requestId());

    app.use((req, _res, next) => { req.ctx = { db }; next(); });

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
