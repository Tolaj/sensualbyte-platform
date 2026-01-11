// apps/api/src/routes/identity.routes.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { identityController } from "../controllers/identity.controller.js";
import { asyncHandler } from "../utils/http.js";

export function identityRoutes() {
    const r = Router();
    r.use(requireAuth());

    // controller factory (stateless)
    const ctrl = (req) => identityController(req.ctx.db);

    // users
    r.get("/users", asyncHandler((req, res) => ctrl(req).listUsers(req, res)));
    r.post("/users", asyncHandler((req, res) => ctrl(req).createUser(req, res)));

    // teams
    r.get("/teams", asyncHandler((req, res) => ctrl(req).listTeams(req, res)));
    r.post("/teams", asyncHandler((req, res) => ctrl(req).createTeam(req, res)));

    // team members (IAM bindings on scopeType=team)
    r.get("/teams/:teamId/members", asyncHandler((req, res) => ctrl(req).listTeamMembers(req, res)));
    r.post("/teams/:teamId/members", asyncHandler((req, res) => ctrl(req).addTeamMember(req, res)));
    r.delete("/teams/:teamId/members/:userId", asyncHandler((req, res) => ctrl(req).removeTeamMember(req, res)));

    // IAM roles + bindings
    r.get("/iam/roles", asyncHandler((req, res) => ctrl(req).listIamRoles(req, res)));
    r.get("/iam/bindings", asyncHandler((req, res) => ctrl(req).listIamBindings(req, res)));
    r.post("/iam/bindings", asyncHandler((req, res) => ctrl(req).grantIamBinding(req, res)));
    r.delete("/iam/bindings", asyncHandler((req, res) => ctrl(req).revokeIamBinding(req, res)));

    return r;
}
