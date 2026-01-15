// apps/api/src/controllers/auth.controller.js
import { authService } from "../services/auth.service.js";

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}
const badRequest = (m, d) => httpError(400, m, d);

export function authController(db) {
    const svc = authService(db);

    return {
        register: async (req, res) => {
            const { email, password, name } = req.body || {};
            if (!email || !password || !name) throw badRequest("email, password, name required");
            const out = await svc.register({ email, password, name });
            res.json(out);
        },

        login: async (req, res) => {
            const { email, password } = req.body || {};
            if (!email || !password) throw badRequest("email, password required");
            const out = await svc.login({ email, password });
            res.json(out);
        },

        me: async (req, res) => {
            // populated by requireAuth() via DB load
            res.json({
                user: req.user || { userId: req.userId || "user_demo" },
            });
        },
    };
}
