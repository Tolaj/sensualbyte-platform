// apps/api/src/routes/auth.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { authController } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/http.js";

export function authRoutes() {
    const r = Router();
    const ctrl = (req) => authController(req.ctx.db);

    // ✅ public
    r.post("/register", asyncHandler((req, res) => ctrl(req).register(req, res)));
    r.post("/login", asyncHandler((req, res) => ctrl(req).login(req, res)));

    // ✅ protected (same path as before)
    r.get("/me", requireAuth(), asyncHandler((req, res) => ctrl(req).me(req, res)));

    return r;
}
