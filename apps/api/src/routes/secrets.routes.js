import { Router } from "express";
import { secretsController } from "../controllers/secrets.controller.js";
import { requireAuth } from "../middleware/auth.js";

export function secretsRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.get("/", async (req, res, next) => { try { await secretsController(req.ctx.db).list(req, res); } catch (e) { next(e); } });
    r.get("/:secretId", async (req, res, next) => { try { await secretsController(req.ctx.db).get(req, res); } catch (e) { next(e); } });

    return r;
}
