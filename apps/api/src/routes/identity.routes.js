import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { identityController } from "../controllers/identity.controller.js";

export function identityRoutes() {
    const r = Router();
    r.use(requireAuth());

    // users
    r.get("/users", async (req, res, next) => { try { await identityController(req.ctx.db).listUsers(req, res); } catch (e) { next(e); } });
    r.post("/users", async (req, res, next) => { try { await identityController(req.ctx.db).createUser(req, res); } catch (e) { next(e); } });

    // teams
    r.get("/teams", async (req, res, next) => { try { await identityController(req.ctx.db).listTeams(req, res); } catch (e) { next(e); } });
    r.post("/teams", async (req, res, next) => { try { await identityController(req.ctx.db).createTeam(req, res); } catch (e) { next(e); } });

    r.get("/teams/:teamId/members", async (req, res, next) => { try { await identityController(req.ctx.db).listTeamMembers(req, res); } catch (e) { next(e); } });
    r.post("/teams/:teamId/members", async (req, res, next) => { try { await identityController(req.ctx.db).addTeamMember(req, res); } catch (e) { next(e); } });
    r.delete("/teams/:teamId/members/:userId", async (req, res, next) => { try { await identityController(req.ctx.db).removeTeamMember(req, res); } catch (e) { next(e); } });

    // rbac role bindings
    r.get("/role-bindings", async (req, res, next) => { try { await identityController(req.ctx.db).listRoleBindings(req, res); } catch (e) { next(e); } });
    r.post("/role-bindings", async (req, res, next) => { try { await identityController(req.ctx.db).upsertRoleBinding(req, res); } catch (e) { next(e); } });

    return r;
}
