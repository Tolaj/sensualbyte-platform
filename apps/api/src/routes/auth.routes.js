import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { authController } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/http.js";

export function authRoutes() {
    const r = Router();
    r.use(requireAuth());

    r.get("/me", asyncHandler((req, res) => authController().me(req, res)));

    return r;
}
