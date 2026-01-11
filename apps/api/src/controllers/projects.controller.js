// apps/api/src/controllers/projects.controller.js
import { projectsRepo } from "../repos/projects.repo.js";
import { newId } from "../utils/ids.js";
import { auditService } from "../services/audit.service.js";
import { iamBindingsRepo } from "../repos/iamBindings.repo.js";

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

function isMongoDup(err) {
    return err?.code === 11000 || /E11000 duplicate key/i.test(String(err?.message || ""));
}

const TEAM_CAN_CREATE_PROJECT = new Set(["team_owner", "team_member"]);
const TEAM_CAN_READ = new Set(["team_owner", "team_member", "team_viewer"]);
const PROJECT_CAN_READ = new Set(["project_owner", "project_editor", "project_viewer"]);

async function requireTeamRole(db, teamId, actorUserId, isSuperAdmin, allowedRoleIds) {
    if (isSuperAdmin) return;

    const b = await db.collection("iam_bindings").findOne({
        scopeType: "team",
        scopeId: String(teamId),
        subjectType: "user",
        subjectId: String(actorUserId),
        roleId: { $in: Array.from(allowedRoleIds) }
    });

    if (!b) throw forbidden("Forbidden: team role required", { teamId });
}

async function requireProjectRead(db, projectId, actorUserId, isSuperAdmin) {
    const p = await db.collection("projects").findOne({ projectId: String(projectId) });
    if (!p) throw notFound("Project not found", { projectId });

    if (isSuperAdmin) return p;

    const projectBind = await db.collection("iam_bindings").findOne({
        scopeType: "project",
        scopeId: String(projectId),
        subjectType: "user",
        subjectId: String(actorUserId),
        roleId: { $in: Array.from(PROJECT_CAN_READ) }
    });

    if (projectBind) return p;

    const teamBind = await db.collection("iam_bindings").findOne({
        scopeType: "team",
        scopeId: String(p.teamId),
        subjectType: "user",
        subjectId: String(actorUserId),
        roleId: { $in: Array.from(TEAM_CAN_READ) }
    });

    if (!teamBind) throw forbidden("Forbidden", { projectId });
    return p;
}

export function projectsController(db) {
    const projects = projectsRepo(db);
    const audit = auditService(db);
    const iamBindings = iamBindingsRepo(db);

    return {
        list: async (req, res) => {
            const teamId = String(req.query.teamId || "");
            if (!teamId) throw badRequest("teamId required");

            const t = await db.collection("teams").findOne({ teamId });
            if (!t) throw badRequest("Unknown teamId", { teamId });

            await requireTeamRole(db, teamId, req.userId, req.isSuperAdmin, TEAM_CAN_READ);
            res.json({ projects: await projects.listByTeam(teamId) });
        },

        create: async (req, res) => {
            const { teamId, name } = req.body || {};
            if (!teamId || name === undefined) throw badRequest("teamId and name required");

            const nm = String(name).trim();
            if (!nm) throw badRequest("name must be a non-empty string");

            const team = await db.collection("teams").findOne({ teamId: String(teamId) });
            if (!team) throw badRequest("Unknown teamId", { teamId });

            await requireTeamRole(db, String(teamId), req.userId, req.isSuperAdmin, TEAM_CAN_CREATE_PROJECT);

            const now = new Date();
            const projectId = newId("proj");
            const doc = {
                projectId,
                teamId: String(teamId),
                name: nm,
                createdBy: req.userId,
                createdAt: now,
                updatedAt: now
            };

            try {
                await projects.create(doc);
            } catch (err) {
                if (isMongoDup(err)) throw conflict("Project already exists", { teamId: doc.teamId, name: doc.name });
                throw err;
            }

            await iamBindings.upsert({
                bindingId: newId("bind"),
                scopeType: "project",
                scopeId: projectId,
                subjectType: "user",
                subjectId: req.userId,
                roleId: "project_owner",
                createdBy: req.userId,
                createdAt: now
            });

            await audit.log({
                actorUserId: req.userId,
                action: "project.create",
                resourceType: "project",
                resourceId: projectId,
                metadata: { teamId: doc.teamId, name: doc.name }
            });

            res.status(201).json({ project: doc });
        },

        get: async (req, res) => {
            const projectId = String(req.params.projectId);
            const project = await requireProjectRead(db, projectId, req.userId, req.isSuperAdmin);
            res.json({ project });
        }
    };
}
