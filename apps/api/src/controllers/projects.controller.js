import { projectsRepo } from "../repos/projects.repo.js";
import { roleBindingsRepo } from "../repos/roleBindings.repo.js";
import { newId } from "../utils/ids.js";
import { auditService } from "../services/audit.service.js";

export function projectsController(db) {
    const projects = projectsRepo(db);
    const bindings = roleBindingsRepo(db);
    const audit = auditService(db);

    return {
        list: async (req, res) => {
            const teamId = req.query.teamId;
            if (!teamId) { const e = new Error("teamId required"); e.statusCode = 400; throw e; }
            res.json({ projects: await projects.listByTeam(teamId) });
        },

        create: async (req, res) => {
            const { teamId, name } = req.body || {};
            if (!teamId || !name) { const e = new Error("teamId and name required"); e.statusCode = 400; throw e; }

            const now = new Date();
            const projectId = newId("proj");
            const doc = { projectId, teamId, name, createdBy: req.userId, createdAt: now, updatedAt: now };
            await projects.create(doc);

            // creator owner on project
            await bindings.upsert({
                resourceType: "project",
                resourceId: projectId,
                subjectType: "user",
                subjectId: req.userId,
                role: "owner",
                createdAt: now
            });

            await audit.log({ actorUserId: req.userId, action: "project.create", resourceType: "project", resourceId: projectId, metadata: { teamId, name } });

            res.status(201).json({ project: doc });
        },

        get: async (req, res) => {
            const projectId = req.params.projectId;
            const p = await projects.getByProjectId(projectId);
            if (!p) { const e = new Error("Project not found"); e.statusCode = 404; throw e; }
            res.json({ project: p });
        }
    };
}
