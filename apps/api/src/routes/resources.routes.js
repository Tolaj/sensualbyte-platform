import { Router } from "express";
import { resourcesController } from "../controllers/resources.controller.js";
import { requireAuth } from "../middleware/auth.js";

export function resourcesRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.post("/", async (req, res, next) => { try { await resourcesController(req.ctx.db).create(req, res); } catch (e) { next(e); } });
    r.get("/", async (req, res, next) => { try { await resourcesController(req.ctx.db).list(req, res); } catch (e) { next(e); } });
    r.get("/:resourceId", async (req, res, next) => { try { await resourcesController(req.ctx.db).get(req, res); } catch (e) { next(e); } });
    r.patch("/:resourceId", async (req, res, next) => { try { await resourcesController(req.ctx.db).patch(req, res); } catch (e) { next(e); } });
    r.delete("/:resourceId", async (req, res, next) => { try { await resourcesController(req.ctx.db).remove(req, res); } catch (e) { next(e); } });

    return r;
}
