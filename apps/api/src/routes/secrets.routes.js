// apps/api/src/routes/secrets.routes.js
import { Router } from "express";
import { secretsController } from "../controllers/secrets.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export function secretsRoutes() {
    const r = Router();
    r.use(requireAuth());

    const ctrl = (req) => secretsController(req.ctx.db);

    r.get("/", asyncHandler((req, res) => ctrl(req).list(req, res)));
    r.get("/:secretId", asyncHandler((req, res) => ctrl(req).get(req, res)));

    return r;
}
