import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { projectsController } from "../controllers/projects.controller.js";
import { asyncHandler } from "../utils/http.js";
import { requirePermission } from "../middleware/iam.js";

export function projectsRoutes() {
  const r = Router();
  r.use(requireAuth());

  r.get("/", asyncHandler((req, res) => projectsController(req.ctx.db).list(req, res)));
  r.post("/", asyncHandler((req, res) => projectsController(req.ctx.db).create(req, res)));

  r.get(
    "/:projectId",
    requirePermission("project.read", (req) => [
      { scopeType: "project", scopeId: String(req.params.projectId) },
      { scopeType: "global", scopeId: "global" }
    ]),
    asyncHandler((req, res) => projectsController(req.ctx.db).get(req, res))
  );

  return r;
}
