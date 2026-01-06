import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { authController } from "../controllers/auth.controller.js";

export function authRoutes() {
    const r = Router();
    r.use(requireAuth());
    r.get("/me", async (req, res, next) => { try { await authController().me(req, res); } catch (e) { next(e); } });
    return r;
}
