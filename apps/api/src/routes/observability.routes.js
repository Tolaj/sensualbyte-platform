import { Router } from "express";
import { observabilityController } from "../controllers/observability.controller.js";
import { requireAuth } from "../middleware/auth.js";

export function observabilityRoutes() {
    const r = Router();
    r.use(requireAuth());
    r.get("/observed/:resourceId", async (req, res, next) => { try { await observabilityController().observed(req, res); } catch (e) { next(e); } });
    return r;
}
