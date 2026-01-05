import { Router } from "express";
import { catalogController } from "../controllers/catalog.controller.js";

export function catalogRoutes() {
    const r = Router();

    r.get("/categories", async (req, res, next) => {
        try {
            const c = catalogController(req.ctx.db);
            await c.listCategories(req, res);
        } catch (e) { next(e); }
    });

    r.get("/items", async (req, res, next) => {
        try {
            const c = catalogController(req.ctx.db);
            await c.listItems(req, res);
        } catch (e) { next(e); }
    });

    return r;
}
