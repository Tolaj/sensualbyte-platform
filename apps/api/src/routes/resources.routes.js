import { Router } from "express";
import { resourcesController } from "../controllers/resources.controller.js";

export function resourcesRoutes() {
    const r = Router();

    r.post("/", async (req, res, next) => {
        try {
            const c = resourcesController(req.ctx.db);
            await c.create(req, res);
        } catch (e) { next(e); }
    });

    r.get("/", async (req, res, next) => {
        try {
            const c = resourcesController(req.ctx.db);
            await c.list(req, res);
        } catch (e) { next(e); }
    });

    r.get("/:resourceId", async (req, res, next) => {
        try {
            const c = resourcesController(req.ctx.db);
            await c.get(req, res);
        } catch (e) { next(e); }
    });

    r.patch("/:resourceId", async (req, res, next) => {
        try {
            const c = resourcesController(req.ctx.db);
            await c.update(req, res);
        } catch (e) { next(e); }
    });

    r.delete("/:resourceId", async (req, res, next) => {
        try {
            const c = resourcesController(req.ctx.db);
            await c.remove(req, res);
        } catch (e) { next(e); }
    });

    return r;
}
