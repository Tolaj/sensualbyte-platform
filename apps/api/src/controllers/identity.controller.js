import { usersRepo } from "../repos/users.repo.js";
import { teamsRepo } from "../repos/teams.repo.js";
import { teamMembersRepo } from "../repos/teamMembers.repo.js";
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

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function safeUser(doc) {
    if (!doc) return doc;
    const { passwordHash, ...safe } = doc;
    return safe;
}

export function identityController(db) {
    const users = usersRepo(db);
    const teams = teamsRepo(db);
    const members = teamMembersRepo(db);
    const bindings = roleBindingsRepo(db);
    const audit = auditService(db);

    return {
        // USERS (v1 minimal)
        listUsers: async (_req, res) => {
            const rows = await users.list();
            res.json({ users: rows.map(safeUser) });
        },

        createUser: async (req, res) => {
            const { email, passwordHash, name, username, globalRole } = req.body || {};
            const emailNorm = normalizeEmail(email);

            if (!emailNorm || !passwordHash) {
                throw badRequest("email and passwordHash required (v1)", { email: emailNorm });
            }

            const now = new Date();
            const doc = {
                userId: newId("user"),
                email: emailNorm,
                passwordHash: String(passwordHash),
                name: name ? String(name) : null,
                username: username ? String(username) : null,
                globalRole: globalRole ? String(globalRole) : "user",
                active: true,
                createdAt: now,
                updatedAt: now,
                lastLoginAt: null
            };

            try {
                await users.create(doc);
            } catch (err) {
                if (isMongoDup(err)) throw conflict("User already exists", { email: emailNorm });
                throw err;
            }

            await audit.log({
                actorUserId: req.userId,
                action: "user.create",
                resourceType: "user",
                resourceId: doc.userId,
                metadata: { email: emailNorm }
            });

            res.status(201).json({ user: safeUser(doc) });
        },

        // TEAMS
        listTeams: async (_req, res) => {
            res.json({ teams: await teams.list() });
        },

        createTeam: async (req, res) => {
            const { name } = req.body || {};
            if (!name || !String(name).trim()) throw badRequest("name required");

            const now = new Date();
            const teamId = newId("team");
            const doc = { teamId, name: String(name).trim(), createdBy: req.userId, createdAt: now };

            try {
                await teams.create(doc);
            } catch (err) {
                if (isMongoDup(err)) throw conflict("Team already exists", { name: doc.name });
                throw err;
            }

            // creator becomes team owner
            await members.addOrUpdateRole({
                teamId,
                userId: req.userId,
                role: "owner",
                createdAt: now
            });

            await audit.log({
                actorUserId: req.userId,
                action: "team.create",
                resourceType: "team",
                resourceId: teamId,
                metadata: { name: doc.name }
            });

            res.status(201).json({ team: doc });
        },

        listTeamMembers: async (req, res) => {
            const teamId = String(req.params.teamId);
            res.json({ members: await members.listByTeam(teamId) });
        },

        addTeamMember: async (req, res) => {
            const teamId = String(req.params.teamId);
            const { userId, role } = req.body || {};

            if (!userId) throw badRequest("userId required");

            const now = new Date();
            const doc = {
                teamId,
                userId: String(userId),
                role: role ? String(role) : "member",
                createdAt: now
            };

            try {
                await members.addOrUpdateRole(doc);
            } catch (err) {
                if (isMongoDup(err)) throw conflict("Member already exists", { teamId, userId: doc.userId });
                throw err;
            }

            await audit.log({
                actorUserId: req.userId,
                action: "team.member.add",
                resourceType: "team",
                resourceId: teamId,
                metadata: { userId: doc.userId, role: doc.role }
            });

            res.status(201).json({ member: doc });
        },

        removeTeamMember: async (req, res) => {
            const teamId = String(req.params.teamId);
            const userId = String(req.params.userId);

            await members.remove(teamId, userId);

            await audit.log({
                actorUserId: req.userId,
                action: "team.member.remove",
                resourceType: "team",
                resourceId: teamId,
                metadata: { userId }
            });

            res.json({ removed: true });
        },

        // ROLE BINDINGS (resource-level RBAC)
        listRoleBindings: async (req, res) => {
            const resourceType = String(req.query.resourceType || "");
            const resourceId = String(req.query.resourceId || "");
            if (!resourceType || !resourceId) throw badRequest("resourceType & resourceId required");

            res.json({ roleBindings: await bindings.listForResource(resourceType, resourceId) });
        },

        upsertRoleBinding: async (req, res) => {
            const { resourceType, resourceId, subjectType, subjectId, role } = req.body || {};

            if (!resourceType || !resourceId || !subjectType || !subjectId || !role) {
                throw badRequest("resourceType,resourceId,subjectType,subjectId,role required", {
                    resourceType,
                    resourceId,
                    subjectType,
                    subjectId,
                    role
                });
            }

            const now = new Date();
            const doc = {
                resourceType: String(resourceType),
                resourceId: String(resourceId),
                subjectType: String(subjectType),
                subjectId: String(subjectId),
                role: String(role),
                createdAt: now
            };

            await bindings.upsert(doc);

            await audit.log({
                actorUserId: req.userId,
                action: "rbac.binding.upsert",
                resourceType: doc.resourceType,
                resourceId: doc.resourceId,
                metadata: { subjectType: doc.subjectType, subjectId: doc.subjectId, role: doc.role }
            });

            res.status(201).json({ roleBinding: doc });
        }
    };
}
