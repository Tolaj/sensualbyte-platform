import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectRole } from "../middleware/rbac.js";
import { projectsController } from "../controllers/projects.controller.js";
import { asyncHandler } from "../utils/http.js";

export function projectsRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.get("/", asyncHandler((req, res) => projectsController(req.ctx.db).list(req, res)));
    r.post("/", asyncHandler((req, res) => projectsController(req.ctx.db).create(req, res)));

    r.get(
        "/:projectId",
        requireProjectRole("viewer"),
        asyncHandler((req, res) => projectsController(req.ctx.db).get(req, res))
    );

    return r;
}
