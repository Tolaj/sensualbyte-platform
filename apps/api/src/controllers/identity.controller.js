import { usersRepo } from "../repos/users.repo.js";
import { teamsRepo } from "../repos/teams.repo.js";
import { teamMembersRepo } from "../repos/teamMembers.repo.js";
import { roleBindingsRepo } from "../repos/roleBindings.repo.js";
import { newId } from "../utils/ids.js";
import { auditService } from "../services/audit.service.js";

export function identityController(db) {
    const users = usersRepo(db);
    const teams = teamsRepo(db);
    const members = teamMembersRepo(db);
    const bindings = roleBindingsRepo(db);
    const audit = auditService(db);

    return {
        // USERS (v1 minimal)
        listUsers: async (_req, res) => res.json({ users: await users.list() }),

        createUser: async (req, res) => {
            const { email, passwordHash, name, username, globalRole } = req.body || {};
            if (!email || !passwordHash) {
                const e = new Error("email and passwordHash required (v1)");
                e.statusCode = 400;
                throw e;
            }
            const now = new Date();
            const doc = {
                userId: newId("user"),
                email,
                passwordHash,
                name: name || null,
                username: username || null,
                globalRole: globalRole || "user",
                active: true,
                createdAt: now,
                updatedAt: now,
                lastLoginAt: null
            };
            await users.create(doc);
            await audit.log({ actorUserId: req.userId, action: "user.create", resourceType: "user", resourceId: doc.userId, metadata: { email } });
            res.status(201).json({ user: { ...doc, passwordHash: "***" } });
        },

        // TEAMS
        listTeams: async (_req, res) => res.json({ teams: await teams.list() }),

        createTeam: async (req, res) => {
            const { name } = req.body || {};
            if (!name) { const e = new Error("name required"); e.statusCode = 400; throw e; }
            const now = new Date();
            const teamId = newId("team");
            const doc = { teamId, name, createdBy: req.userId, createdAt: now };

            await teams.create(doc);

            // creator becomes team owner
            await members.add({ teamId, userId: req.userId, role: "owner", createdAt: now });

            await audit.log({ actorUserId: req.userId, action: "team.create", resourceType: "team", resourceId: teamId, metadata: { name } });
            res.status(201).json({ team: doc });
        },

        listTeamMembers: async (req, res) => {
            const teamId = req.params.teamId;
            res.json({ members: await members.listByTeam(teamId) });
        },

        addTeamMember: async (req, res) => {
            const teamId = req.params.teamId;
            const { userId, role } = req.body || {};
            if (!userId) { const e = new Error("userId required"); e.statusCode = 400; throw e; }

            const now = new Date();
            const doc = { teamId, userId, role: role || "member", createdAt: now };
            await members.add(doc);

            await audit.log({ actorUserId: req.userId, action: "team.member.add", resourceType: "team", resourceId: teamId, metadata: { userId, role: doc.role } });
            res.status(201).json({ member: doc });
        },

        removeTeamMember: async (req, res) => {
            const teamId = req.params.teamId;
            const userId = req.params.userId;
            await members.remove(teamId, userId);
            await audit.log({ actorUserId: req.userId, action: "team.member.remove", resourceType: "team", resourceId: teamId, metadata: { userId } });
            res.json({ removed: true });
        },

        // ROLE BINDINGS (resource-level RBAC)
        listRoleBindings: async (req, res) => {
            const { resourceType, resourceId } = req.query;
            if (!resourceType || !resourceId) { const e = new Error("resourceType & resourceId required"); e.statusCode = 400; throw e; }
            res.json({ roleBindings: await bindings.listForResource(resourceType, resourceId) });
        },

        upsertRoleBinding: async (req, res) => {
            const { resourceType, resourceId, subjectType, subjectId, role } = req.body || {};
            if (!resourceType || !resourceId || !subjectType || !subjectId || !role) {
                const e = new Error("resourceType,resourceId,subjectType,subjectId,role required");
                e.statusCode = 400;
                throw e;
            }
            const doc = { resourceType, resourceId, subjectType, subjectId, role, createdAt: new Date() };
            await bindings.upsert(doc);
            await audit.log({ actorUserId: req.userId, action: "rbac.binding.upsert", resourceType, resourceId, metadata: { subjectType, subjectId, role } });
            res.status(201).json({ roleBinding: doc });
        }
    };
}
