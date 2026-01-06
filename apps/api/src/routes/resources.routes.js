import { Router } from "express";
import { resourcesController } from "../controllers/resources.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export function resourcesRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.post("/", asyncHandler((req, res) => resourcesController(req.ctx.db).create(req, res)));
    r.get("/", asyncHandler((req, res) => resourcesController(req.ctx.db).list(req, res)));
    r.get("/:resourceId", asyncHandler((req, res) => resourcesController(req.ctx.db).get(req, res)));
    r.patch("/:resourceId", asyncHandler((req, res) => resourcesController(req.ctx.db).patch(req, res)));
    r.delete("/:resourceId", asyncHandler((req, res) => resourcesController(req.ctx.db).remove(req, res)));

    return r;
}
