import { Router } from "express";
import { secretsController } from "../controllers/secrets.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export function secretsRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.get("/", asyncHandler((req, res) => secretsController(req.ctx.db).list(req, res)));
    r.get("/:secretId", asyncHandler((req, res) => secretsController(req.ctx.db).get(req, res)));

    return r;
}
