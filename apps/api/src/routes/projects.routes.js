import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { projectsController } from "../controllers/projects.controller.js";
import { asyncHandler } from "../utils/http.js";
import { requirePermission } from "../middleware/iam.js";

function requireDb(req) {
  const db = req.ctx?.db;
  if (!db) {
    const e = new Error("Request context misconfigured: db not available");
    e.statusCode = 500;
    throw e;
  }
  return db;
}

function globalScope() {
  return [{ scopeType: "global", scopeId: "global" }];
}

function projectScopesFromCtx(req) {
  const pid = String(req.ctx?.projectScope?.projectId || "").trim();
  const tid = String(req.ctx?.projectScope?.teamId || "").trim();

  const scopes = [];
  if (pid) scopes.push({ scopeType: "project", scopeId: pid });
  if (tid) scopes.push({ scopeType: "team", scopeId: tid });
  scopes.push({ scopeType: "global", scopeId: "global" });

  return scopes;
}

function withProjectScopeFromParam() {
  return async (req, _res, next) => {
    try {
      const db = requireDb(req);
      const projectId = String(req.params.projectId || "").trim();
      if (!projectId) {
        const e = new Error("projectId required");
        e.statusCode = 400;
        throw e;
      }

      const p = await db
        .collection("projects")
        .findOne(
          { projectId },
          { projection: { _id: 0, projectId: 1, teamId: 1 } }
        );

      if (!p) {
        const e = new Error("Not found");
        e.statusCode = 404;
        throw e;
      }

      const teamId = String(p.teamId || "").trim();
      if (!teamId) {
        const e = new Error("Project missing teamId");
        e.statusCode = 500;
        throw e;
      }

      req.ctx.projectScope = { projectId: String(p.projectId), teamId };
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function projectsRoutes() {
  const r = Router();
  r.use(requireAuth());

  // keep list/create semantics in controller (team checks)
  r.get("/", asyncHandler((req, res) => projectsController(req.ctx.db).list(req, res)));
  r.post("/", asyncHandler((req, res) => projectsController(req.ctx.db).create(req, res)));

  // ✅ preserve "team binding grants project read" by including team scope
  r.get(
    "/:projectId",
    withProjectScopeFromParam(),
    requirePermission("project.read", (req) => projectScopesFromCtx(req)),
    asyncHandler((req, res) => projectsController(req.ctx.db).get(req, res))
  );

  return r;
}
