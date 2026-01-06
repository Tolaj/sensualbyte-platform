import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { identityController } from "../controllers/identity.controller.js";
import { asyncHandler } from "../utils/http.js";

export function identityRoutes() {
    const r = Router();
    r.use(requireAuth());

    // users
    r.get("/users", asyncHandler((req, res) => identityController(req.ctx.db).listUsers(req, res)));
    r.post("/users", asyncHandler((req, res) => identityController(req.ctx.db).createUser(req, res)));

    // teams
    r.get("/teams", asyncHandler((req, res) => identityController(req.ctx.db).listTeams(req, res)));
    r.post("/teams", asyncHandler((req, res) => identityController(req.ctx.db).createTeam(req, res)));

    r.get("/teams/:teamId/members", asyncHandler((req, res) => identityController(req.ctx.db).listTeamMembers(req, res)));
    r.post("/teams/:teamId/members", asyncHandler((req, res) => identityController(req.ctx.db).addTeamMember(req, res)));
    r.delete("/teams/:teamId/members/:userId", asyncHandler((req, res) => identityController(req.ctx.db).removeTeamMember(req, res)));

    // role bindings
    r.get("/role-bindings", asyncHandler((req, res) => identityController(req.ctx.db).listRoleBindings(req, res)));
    r.post("/role-bindings", asyncHandler((req, res) => identityController(req.ctx.db).upsertRoleBinding(req, res)));

    return r;
}
