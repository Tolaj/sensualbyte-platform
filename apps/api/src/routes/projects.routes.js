import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectRole } from "../middleware/rbac.js";
import { projectsController } from "../controllers/projects.controller.js";

export function projectsRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.get("/", async (req, res, next) => { try { await projectsController(req.ctx.db).list(req, res); } catch (e) { next(e); } });
    r.post("/", async (req, res, next) => { try { await projectsController(req.ctx.db).create(req, res); } catch (e) { next(e); } });

    // project read requires at least viewer
    r.get("/:projectId", requireProjectRole("viewer"), async (req, res, next) => {
        try { await projectsController(req.ctx.db).get(req, res); } catch (e) { next(e); }
    });

    return r;
}
