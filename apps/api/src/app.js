import express from "express";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/error.js";

import { catalogRoutes } from "./routes/catalog.routes.js";
import { resourcesRoutes } from "./routes/resources.routes.js";

export function createApp({ db }) {
    const app = express();

    app.use(express.json({ limit: "1mb" }));
    app.use(requestId());

    // attach db to req context
    app.use((req, _res, next) => {
        req.ctx = { db };
        next();
    });

    app.get("/healthz", (_req, res) => res.json({ ok: true }));

    app.use("/v1/catalog", catalogRoutes());
    app.use("/v1/resources", resourcesRoutes());

    app.use(errorHandler());
    return app;
}
