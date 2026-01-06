import { Router } from "express";
import { observabilityController } from "../controllers/observability.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export function observabilityRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.get("/observed/:resourceId", asyncHandler((req, res) => observabilityController().observed(req, res)));
    r.get("/observed", asyncHandler((req, res) => observabilityController().observedList(req, res)));

    return r;
}
