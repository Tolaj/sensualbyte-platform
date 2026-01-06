import { Router } from "express";
import { catalogController } from "../controllers/catalog.controller.js";

export function catalogRoutes() {
    const r = Router();
    r.get("/categories", async (req, res, next) => { try { await catalogController(req.ctx.db).listCategories(req, res); } catch (e) { next(e); } });
    r.get("/items", async (req, res, next) => { try { await catalogController(req.ctx.db).listItems(req, res); } catch (e) { next(e); } });
    return r;
}
