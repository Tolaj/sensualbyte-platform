import { projectsRepo } from "../repos/projects.repo.js";
import { roleBindingsRepo } from "../repos/roleBindings.repo.js";
import { newId } from "../utils/ids.js";
import { auditService } from "../services/audit.service.js";

function badRequest(message, details = null) {
    const e = new Error(message);
    e.statusCode = 400;
    if (details) e.details = details;
    return e;
}

function conflict(message, details = null) {
    const e = new Error(message);
    e.statusCode = 409;
    if (details) e.details = details;
    return e;
}

function isMongoDup(err) {
    return err?.code === 11000 || /E11000 duplicate key/i.test(String(err?.message || ""));
}

export function projectsController(db) {
    const projects = projectsRepo(db);
    const bindings = roleBindingsRepo(db);
    const audit = auditService(db);

    return {
        list: async (req, res) => {
            const teamId = String(req.query.teamId || "");
            if (!teamId) throw badRequest("teamId required");
            res.json({ projects: await projects.listByTeam(teamId) });
        },

        create: async (req, res) => {
            const { teamId, name } = req.body || {};
            if (!teamId || !name) throw badRequest("teamId and name required");

            const now = new Date();
            const projectId = newId("proj");
            const doc = {
                projectId,
                teamId: String(teamId),
                name: String(name).trim(),
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

            // creator owner on project
            await bindings.upsert({
                resourceType: "project",
                resourceId: projectId,
                subjectType: "user",
                subjectId: req.userId,
                role: "owner",
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
            const p = await projects.getByProjectId(projectId);
            if (!p) {
                const e = new Error("Project not found");
                e.statusCode = 404;
                throw e;
            }
            res.json({ project: p });
        }
    };
}
