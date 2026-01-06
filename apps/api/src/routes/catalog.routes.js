import { Router } from "express";
import { catalogController } from "../controllers/catalog.controller.js";

function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function catalogRoutes() {
    const r = Router();

    r.get("/categories", asyncHandler((req, res) => catalogController(req.ctx.db).listCategories(req, res)));
    r.get("/items", asyncHandler((req, res) => catalogController(req.ctx.db).listItems(req, res)));

    return r;
}
