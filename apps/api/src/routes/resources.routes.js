import { Router } from "express";
import { resourcesController } from "../controllers/resources.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

function requireDb(req) {
    const db = req.ctx?.db;
    if (!db) {
        const e = new Error("Request context misconfigured: db not available");
        e.statusCode = 500;
        throw e;
    }
    return db;
}

export function resourcesRoutes() {
    const r = Router();
    r.use(requireAuth());

    const ctrl = (req) => resourcesController(requireDb(req));

    r.post("/", asyncHandler((req, res) => ctrl(req).create(req, res)));
    r.get("/", asyncHandler((req, res) => ctrl(req).list(req, res)));
    r.get("/:resourceId", asyncHandler((req, res) => ctrl(req).get(req, res)));
    r.patch("/:resourceId", asyncHandler((req, res) => ctrl(req).patch(req, res)));
    r.delete("/:resourceId", asyncHandler((req, res) => ctrl(req).remove(req, res)));

    return r;
}
