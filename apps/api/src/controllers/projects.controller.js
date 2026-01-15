// apps/api/src/controllers/projects.controller.js
import { projectsRepo } from "../repos/projects.repo.js";
import { newId } from "../utils/ids.js";
import { auditService } from "../services/audit.service.js";
import { iamBindingsRepo } from "../repos/iamBindings.repo.js";

function isProd() {
    return (process.env.NODE_ENV || "development") === "production";
}

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}

const badRequest = (m, d) => httpError(400, m, d);
const forbidden = (m = "Forbidden", d) => httpError(403, m, d);
const notFound = (m = "Not found", d) => httpError(404, m, d);
const conflict = (m, d) => httpError(409, m, d);

function safeErrDetails(details) {
    return isProd() ? null : details;
}

function isMongoDup(err) {
    return err?.code === 11000 || /E11000 duplicate key/i.test(String(err?.message || ""));
}

function normStr(v) {
    return String(v ?? "").trim();
}

function validateId(label, v) {
    const s = normStr(v);
    if (!s) throw badRequest(`${label} required`);
    if (s.length > 120) throw badRequest(`${label} too long`);
    // Keep compatible with existing ids produced by newId("team"/"proj"/"user")
    if (!/^[a-zA-Z0-9._-]+$/.test(s)) throw badRequest(`Invalid ${label}`, safeErrDetails({ value: s }));
    return s;
}

function validateName(v) {
    const s = normStr(v);
    if (!s) throw badRequest("name must be a non-empty string");
    if (s.length > 120) throw badRequest("name too long");
    return s;
}

// Backward compatible defaults (existing behavior):
// - team_owner and team_member can create projects
// You can lock this down in prod by setting TEAM_CREATE_PROJECT_ROLES=team_owner
function getTeamCreateProjectRoles() {
    const raw = normStr(process.env.TEAM_CREATE_PROJECT_ROLES);
    if (!raw) return new Set(["team_owner", "team_member"]); // keep old behavior
    return new Set(
        raw
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
    );
}

const TEAM_CAN_READ = new Set(["team_owner", "team_member", "team_viewer"]);
const PROJECT_CAN_READ = new Set(["project_owner", "project_editor", "project_viewer"]);

async function requireTeamRole(db, teamId, actorUserId, isSuperAdmin, allowedRoleIds) {
    if (isSuperAdmin) return;

    const b = await db.collection("iam_bindings").findOne(
        {
            scopeType: "team",
            scopeId: String(teamId),
            subjectType: "user",
            subjectId: String(actorUserId),
            roleId: { $in: Array.from(allowedRoleIds) },
        },
        { projection: { _id: 1, roleId: 1 } }
    );

    if (!b) throw forbidden("Forbidden: team role required", safeErrDetails({ teamId }));
}

async function requireProjectRead(db, projectId, actorUserId, isSuperAdmin) {
    const pid = validateId("projectId", projectId);

    const p = await db.collection("projects").findOne({ projectId: String(pid) });
    if (!p) throw notFound("Project not found", safeErrDetails({ projectId: pid }));

    if (isSuperAdmin) return p;

    // Fast path: project binding
    const projectBind = await db.collection("iam_bindings").findOne(
        {
            scopeType: "project",
            scopeId: String(pid),
            subjectType: "user",
            subjectId: String(actorUserId),
            roleId: { $in: Array.from(PROJECT_CAN_READ) },
        },
        { projection: { _id: 1 } }
    );
    if (projectBind) return p;

    // Fallback: team binding on owning team
    const teamBind = await db.collection("iam_bindings").findOne(
        {
            scopeType: "team",
            scopeId: String(p.teamId),
            subjectType: "user",
            subjectId: String(actorUserId),
            roleId: { $in: Array.from(TEAM_CAN_READ) },
        },
        { projection: { _id: 1 } }
    );

    if (!teamBind) throw forbidden("Forbidden", safeErrDetails({ projectId: pid }));
    return p;
}

export function projectsController(db) {
    const projects = projectsRepo(db);
    const audit = auditService(db);
    const iamBindings = iamBindingsRepo(db);

    return {
        list: async (req, res) => {
            const teamId = validateId("teamId", req.query.teamId);

            const t = await db.collection("teams").findOne(
                { teamId },
                { projection: { _id: 1, teamId: 1 } }
            );
            if (!t) throw badRequest("Unknown teamId", safeErrDetails({ teamId }));

            await requireTeamRole(db, teamId, req.userId, req.isSuperAdmin, TEAM_CAN_READ);

            const rows = await projects.listByTeam(teamId);
            return res.json({ projects: rows });
        },

        create: async (req, res) => {
            const teamId = validateId("teamId", req.body?.teamId);
            const name = validateName(req.body?.name);

            const team = await db.collection("teams").findOne(
                { teamId: String(teamId) },
                { projection: { _id: 1, teamId: 1 } }
            );
            if (!team) throw badRequest("Unknown teamId", safeErrDetails({ teamId }));

            const TEAM_CAN_CREATE_PROJECT = getTeamCreateProjectRoles();
            await requireTeamRole(db, String(teamId), req.userId, req.isSuperAdmin, TEAM_CAN_CREATE_PROJECT);

            const now = new Date();
            const projectId = newId("proj");
            const doc = {
                projectId,
                teamId: String(teamId),
                name,
                createdBy: req.userId,
                createdAt: now,
                updatedAt: now,
            };

            try {
                await projects.create(doc);
            } catch (err) {
                if (isMongoDup(err)) {
                    throw conflict("Project already exists", safeErrDetails({ teamId: doc.teamId, name: doc.name }));
                }
                throw err;
            }

            // Ensure creator has ownership in project scope.
            // Use repo upsert to prevent duplicate bindings.
            await iamBindings.upsert({
                bindingId: newId("bind"),
                scopeType: "project",
                scopeId: projectId,
                subjectType: "user",
                subjectId: req.userId,
                roleId: "project_owner",
                createdBy: req.userId,
                createdAt: now,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "project.create",
                resourceType: "project",
                resourceId: projectId,
                metadata: { teamId: doc.teamId, name: doc.name },
            });

            return res.status(201).json({ project: doc });
        },

        get: async (req, res) => {
            const projectId = validateId("projectId", req.params.projectId);
            const project = await requireProjectRead(db, projectId, req.userId, req.isSuperAdmin);
            return res.json({ project });
        },
    };
}
